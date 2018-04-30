/// Copyright (c) 2018 Ehud Adler
///
/// Permission is hereby granted, free of charge, to any person obtaining a copy
/// of this software and associated documentation files (the "Software"), to deal
/// in the Software without restriction, including without limitation the rights
/// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
/// copies of the Software, and to permit persons to whom the Software is
/// furnished to do so, subject to the following conditions:
///
/// The above copyright notice and this permission notice shall be included in
/// all copies or substantial portions of the Software.
///
/// Notwithstanding the foregoing, you may not use, copy, modify, merge, publish,
/// distribute, sublicense, create a derivative work, and/or sell copies of the
/// Software in any work that is designed, intended, or marketed for pedagogical or
/// instructional purposes related to programming, coding, application development,
/// or information technology.  Permission for such use, copying, modification,
/// merger, publication, distribution, sublicensing, creation of derivative works,
/// or sale is expressly withheld.
///
/// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
/// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
/// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
/// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
/// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
/// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
/// THE SOFTWARE.


/************************************/
/*                                  */
/*            Modules               */
/*                                  */
/************************************/

/// Standing on the shoulder of giants
/// These modules come from Mathias Buus
const peernet     = require('peer-network')
const jsonStream  = require('duplex-json-stream')
const streamSet   = require('stream-set')

/// Standard modules
const net   = require('net')
const http  = require('http');
const SHA256 = require('crypto-js/sha256')
const crypto2 = require('crypto2');


class Block {
    constructor(index, timestamp, data, previousHash)
    {
        this.index          = index;
        this.timestamp      = timestamp;
        this.data           = data;
        this.previousHash   = previousHash;
        this.hash           = this.calculateHash();
        this.nonce          = 0;
    }

    calculateHash(){ return SHA256(this.index + this.previousHash + this.timestamp + JSON.stringify(this.data) + this.nonce).toString() }

    mineBlock(difficulty)
    {
        while(this.hash.substring(0, difficulty) !== Array(difficulty + 1).join("0")){
            this.hash = this.calculateHash()
            this.nonce += 1;
        }
        
    }
}

class Blockchain 
{
    constructor()
    {
        this.chain = [this.createGenisisBlock()] // The array of blocks
        this.difficulty = 3;
    }

    createGenisisBlock()
    {
        return new Block(0, "01/01/2018", "Genesis Block", "0");
    }

    getLatestBlock()
    {
        return this.chain[this.chain.length -1];
    }

    addBlock(newBlock)
    {
        newBlock.previousHash = this.getLatestBlock().hash;
        newBlock.mineBlock(this.difficulty);
        this.chain.push(newBlock);
    }

}

/************************************/
/*                                  */
/*            Variables             */
/*                                  */
/************************************/

var me = process.argv[2] /* This will act as your username */
var privateKey, publicKey 

var network = peernet() 
var server  = network.createServer()

var blockchain = new Blockchain();

var streams = []

var peers   = [] /* List of username of connected nodes */
var sset    = streamSet() /* TODO, No current use */

/* FOR KEEPING TRACK OF MESSAGES */
var id      = Math.random()
var seq     = 0
var logs    = {}

var mainSocket;

/************************************/
/*                                  */
/*            Methods               */
/*                                  */
/************************************/

function greetDiscoveryServer(name)
{

    http.get('http://ehudadler.ddns.net', function(res) {
        mainSocket = jsonStream(net.connect(9034, res.connection.remoteAddress))
        mainSocket.on('data', function (data) {
            if(data.type == 'Announcement')
            {
                process.stdout.write(data.message)
            }
            else if(data.type == 'Return_Request')
            {
                data.peers.forEach(function(peer) {
                    if (peer != me)
                    {  
                        if(!peers.includes(peer))
                        {
                            peers.push(peer)
                            connectToServer(peer)
                        }
                    }
                });
            }
            else if(data.type == 'Error')
            {
                console.log(data.message)
            }
        })
        mainSocket.write({type: 'Greet', address: name})
        clearText("WELCOME TO THE ATTIC")
    })
}

function connectToServer(address)
{
    var stream = network.connect(address)

    stream.on('peer', function (peer) {
        //console.log('(trying to connect to %s:%d)', peer.host, peer.port)
        //clearText("connecting...")
    })
      
    stream.on('connect', function () {
        clearText('🛎    A NEW MEMBER HAS ARRIVED: ' + address + '    🛎')
        var jStream = jsonStream(stream)

        if(streams[address] != undefined)
        {
            streams[address]["stream"] = jStream
        }
        else
        {
            streams[address] = {stream: jStream}
        }
        
        var keyMessage = {type: 'encrypt', key: publicKey, username: me}
        jStream.write(keyMessage);
    })

    stream.on('data', function (data) {
        sendMessage(data);
    })

}

function setUpServer(me)
{
    server.on('connection', function (socket) {

        mainSocket.write({type: 'Request'})

        socket = jsonStream(socket)
        sset.add(socket)

        socket.on('data', function (encrypted) {

            if(encrypted.type == "encrypt")
            {
                if(streams[encrypted.username] != undefined)
                {
                    streams[encrypted.username]["key"] = encrypted.key
                }
                else
                {
                    streams[encrypted.username] = {key: encrypted.key}
                }

                return
            }
            else if (encrypted.type == "goodbye")
            {

                if (logs[encrypted.log] >= encrypted.seq || encrypted.username == me) return

                logs[encrypted.log] = encrypted.seq 

                delete streams[encrypted.username]
                peers.splice(peers.indexOf(encrypted.username, 1))
                sset.remove(socket)  
                clearText("🚪   " + encrypted.message)

                for (var otherPeer in streams)
                {
                    if(streams[otherPeer].stream != undefined)
                    {
                        streams[otherPeer].stream.write(encrypted)
                    }
                 }

                 return
            }

            decryptMessage(encrypted).then(decrypted => {
                displayMessage(encrypted, decrypted);
            })
        });
    });
     
    server.on('close', function() {

        mainSocket.write({type: 'Goodbye', address: me})

        var next = seq++;
        var message = me + " has left";
        for (var otherPeer in streams)
        {
            if(streams[otherPeer].stream != undefined)
            {
                streams[otherPeer].stream.write({type: 'goodbye', log: id, seq: seq, username: me, message: message})
            }
         }

        server.close()
        console.log("\nGOODBYE");
    });

    server.listen(me);
      
    process.on('SIGINT', function () {
        server.close(function () {
          process.exit();
        });
    });
}

function sendMessage(message)
{
    for (var otherPeer in streams)
    {
        if(streams[otherPeer].stream != undefined && streams[otherPeer].key != undefined)
        {
            encrypt(message, streams[otherPeer].key, otherPeer).then(encryptedData => {
                streams[encryptedData.peer].stream.write(encryptedData.data)
            })
        }
    }
}

function clearText(text)
{
    process.stdout.clearLine();  // clear current text
    process.stdout.cursorTo(0);
    console.log(text)
    process.stdout.cursorTo(0);
    process.stdout.write('➜  ');
}

function displayMessage(encrypted, result)
{

    const data = JSON.parse(result);

    if (logs[data.log] >= data.seq || data.username == me) return

        logs[data.log] = data.seq            
        var inChain = data.chain;

        if(inChain.chain.length > blockchain.chain.length) // Update blockchain
        {
            blockchain.chain = inChain.chain;
        }

        if(data.type == "message")
        {
            clearText("[" + data.username +']: ' + blockchain.chain[blockchain.chain.length - 1].data)
        }
        else if(data.type == "announcement")
        {
            clearText("🛎   " + blockchain.chain[blockchain.chain.length - 1].data)
        }

    sendMessage(data);
}
async function createKeys() 
{
     await crypto2.createKeyPair().then(keys => {
         privateKey = keys.privateKey
         publicKey = keys.publicKey
     })
}
async function decryptMessage(encrypted)
{
   const data = await crypto2.decrypt.rsa(encrypted, privateKey)
   return data
}
async function encrypt(message, publicKey, peer)
{
    const data = await crypto2.encrypt.rsa(message, publicKey);
    return { data: data, peer: peer }
}

/************************************/
/*                                  */
/*              MAIN                */
/*                                  */
/************************************/

createKeys().then(result => {
    setUpServer(me)
    greetDiscoveryServer(me)
});

/******** WRITE MESSAGE ********/
process.stdin.on('data', function (data) {
    var next = seq++;

    var message = data.toString().trim();

    if(message.charAt(0) == "\\") // Personal action
    {
        switch(message.substring(1))
        {
            case "chain":
                console.log(JSON.stringify(blockchain, null, 4))
                break;
            default:
                console.log("NOT AN ACTION")
        }
    }
    else
    {
        blockchain.addBlock(new Block(blockchain.chain.length, Date.now(), message, blockchain.getLatestBlock().previousHash));
        sendMessage({type: 'message', log: id, seq: seq, username: me, chain: blockchain})
    }
    process.stdout.write('➜  ');

});

