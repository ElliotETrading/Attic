var net = require('net')
var jsonStream = require('duplex-json-stream')

var streams = []

var server = net.createServer(function (socket){

    socket = jsonStream(socket)

    socket.on('data', function (data){
        if (data.type == 'Greet')
        {
            console.log("MEMBER JOINED :)")
            if(!streams.includes(data.address))
            {
                streams.push(data.address)
                socket.write({type: 'Return_Request', peers: streams.slice(0, 20)})
            }
            else
            {
                console.log("Invalid username")
                socket.write({type: 'Error', message: "Peer with that username already exists, please pick another"})
            }
        }
        else if (data.type == 'Request')
        {
            socket.write({type: 'Return_Request', peers: streams.slice(0, 20)})
        }
        else if (data.type == 'Goodbye')
        {
            console.log("MEMEBER LEFT :(")
            streams.splice(streams.indexOf(data.address), 1);
        }
    })
})

server.listen(9034)