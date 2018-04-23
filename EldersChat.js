
// SERVER
const SHA256    = require('crypto-js/sha256')

const topology    = require('fully-connected-topology')
const jsonStream  = require('duplex-json-stream')
const streamSet   = require('stream-set')
const register    = require('register-multicast-dns')
const toPort      = require('hash-to-port')
const net         = require('net')
const ip          = require('ip');

var me = process.argv[2]

var swarm   = topology(toAddress(me), null)
var streams = streamSet()
var id      = Math.random()
var seq     = 0
var logs    = {}
var mainSocket = jsonStream(net.connect(19034, '35.227.111.233'))

register(me)

swarm.on('connection', function (socket){
    console.log('ANNOUCMENET: A NEW MEMBER HAS ARRIVED')
    socket = jsonStream(socket)
    streams.add(socket)
    socket.on('data', function (data){
        if( logs[data.log] >= data.seq || data.username == me) return

        logs[data.log] = data.seq
        console.log(data.username +': ' + data.message)
        streams.forEach(function (otherPeers){
            otherPeers.write(data)
        })
        process.stdout.write('➜ ')
    })
})
    
process.stdin.on('data', function (data) {
    var next = seq++
    streams.forEach(function (socket) {
        socket.write({log: id, seq: seq, username: me, message: data.toString().trim()})
    })
})

greetMainServer()

function greetMainServer()
{
    mainSocket.on('data', function (data) {
        if(data.type == 'Announcement')
        {
            process.stdout.write(data.message)
        }
        else if(data.type == 'Return_Request')
        {
            data.peers.forEach(function(peer) {
                swarm.add(peer)
            });
        }
    })

    mainSocket.write({type: 'Greet', address: toAddress(me)})
    console.log('WELCOME TO THE ELDERS OF ZION')
    process.stdout.write('➜ ')
}

function requestPeersForMainServer()
{
    mainSocket.write({type: 'Request'})
}

function toAddress(name)
{
    return ip.address() + ':' + toPort(name)
}

