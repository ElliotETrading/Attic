var net = require('net')
var jsonStream = require('duplex-json-stream')

var streams = []

var server = net.createServer(function (socket){
    socket = jsonStream(socket)

    socket.on('data', function (data){
        if (data.type == 'Greet')
        {
            streams.push(data.address)
            socket.write({type: 'Return_Request', peers: streams.slice(0, 20)})
        }
        else if (data.type == 'Request')
        {
            socket.write({type: 'Return_Request', peers: streams.slice(0, 20)})
        }
    })
})

server.listen(process.env.PORT || 5000)
