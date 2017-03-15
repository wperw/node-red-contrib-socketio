# node-red-contrib-socketio
Implementation for [Node-RED](https://nodered.org/) of the popular [Socket.IO](http://socket.io/).

##Installation
To install node-red-contrib-socketio use this command

`npm i node-red-contrib-socketio`

##Composition
The Socket.IO implementation is made with
* 1 configuration Node that hold the server definitions ad the user can decide if bind SocketIO server on Node-RED port or bind it to anotherport
* 1 input node where the user add all the possible `topic` sent from the client javascript code
* 1 outpu node tath send data received into payload to the client browser

##Usage
To see an example usage go to [Example Chat App](https://flows.nodered.org/flow/71f7da3a14951acb67f94bac1f71812a)

##License
MIT

##Thanks
Thank to @nexflo for translating the comments in English and for pre-sending control data 

