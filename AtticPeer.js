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


/************************************/
/*                                  */
/*            Variables             */
/*                                  */
/************************************/

var me = process.argv[2] /* This will act as your username */

var network = peernet() 
var server  = network.createServer()

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
            //console.log(data)
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
                            connectToServer(peer)
                            peers.push(peer)
                        }
                    }
                });
            }
        })
        mainSocket.write({type: 'Greet', address: name})
        clearText("WELCOME TO THE ELDERS OF ZION")
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
        streams.push(jsonStream(stream))
        //console.log('(connected)')
    })

    stream.on('data', function (data) {
        streams.forEach(function (otherPeers){
            otherPeers.write(data)
        })
        //console.log('data:', data.toString())
    })

}

function setUpServer(me)
{
    server.on('connection', function (socket) {

        mainSocket.write({type: 'Request'})

        socket = jsonStream(socket)
        sset.add(socket)

        socket.on('data', function (data) {
            if( logs[data.log] >= data.seq || data.username == me) return

            logs[data.log] = data.seq
            if(data.type == "message")
            {
                clearText("[" + data.username +']: ' + data.message)
            }
            else if (data.type == "announcement")
            {
                clearText("🚪   " + data.message)
            }
            
            streams.forEach(function (otherPeers){
                otherPeers.write(data)
            });
        });
    });
     
    server.on('close', function() {
        var next = seq++;
        streams.forEach(function (otherPeers) {
            otherPeers.write({type: 'announcement', log: id, seq: seq, username: me, message: me + " has left"});
        });
        console.log("\nGOODBYE");
    });

    server.listen(me);
      
    process.on('SIGINT', function () {
        server.close(function () {
          process.exit();
        });
    });
}

function clearText(text)
{
    process.stdout.clearLine();  // clear current text
    process.stdout.cursorTo(0);
    console.log(text)
    process.stdout.cursorTo(0);
    process.stdout.write('➜  ');
}


/************************************/
/*                                  */
/*              MAIN                */
/*                                  */
/************************************/

setUpServer(me)
greetDiscoveryServer(me)

/******** WRITE MESSAGE ********/
process.stdin.on('data', function (data) {
    var next = seq++;
    streams.forEach(function (otherPeers) {
        otherPeers.write({type: 'message', log: id, seq: seq, username: me, message: data.toString().trim()});
    });
    process.stdout.write('➜  ');
});
