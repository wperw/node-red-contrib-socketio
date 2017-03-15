/**
* Copyright Gallimberti Telemaco 02/02/2017
**/

module.exports = function(RED) {

	var Server = require('socket.io');
	var io;
	var customProperties = {}; 
	
	function socketIoConfig(n) {
		RED.nodes.createNode(this,n);
		// node-specific code goes here
		var node = this;
		this.port = n.port || 80;
		this.sendClient = n.sendClient;
		this.path = n.path || "/socket.io";
		this.bindToNode = n.bindToNode || false;
		
		if(this.bindToNode){
			io = new Server(RED.server);
		} else {
			io = new Server();
			io.serveClient(node.sendClient);
			io.path(node.path);
			io.listen(node.port);
		}
		var bindOn =  this.bindToNode ? "bind to Node-red port" : ("on port " + this.port);
		node.log("Created server " + bindOn);
		
		node.on('close', function() {
			//node.log("Closing server");
			io.close();
			//node.log("Closed server");
		});
		
	}
	
	function socketIoIn(n) {
		RED.nodes.createNode(this,n);
		// node-specific code goes here
		var node = this;
		this.name = n.name;
		this.server = RED.nodes.getNode(n.server);
		this.rules = n.rules || [];
		
		this.specialIOEvent = [{v:"error"},{v:"connect"},{v:"disconnect"},
			{v:"disconnecting"},{v:"newListener"},{v:"removeListener"},{v:"ping"},{v:"pong"}];
			
		//add listener to socket, for now return nothing
		function addListener(socket, val, i){
			socket.on(val.v, function(msgin){
				//node.log("Registered new " + val.v + " event");
				var msg = {};
				RED.util.setMessageProperty(msg, "payload", msgin, true);
				RED.util.setMessageProperty(msg, "socketIOEvent", val.v, true);
				//Throw error  TypeError: Cannot set property listening of #<Server> which has only a getter
				// this is to solve
				//messages into node-red are cloned when they are send
				//so we can't sand socket... =(
				//RED.util.setMessageProperty(msg, "socket", socket, true);
				RED.util.setMessageProperty(msg, "socketIOId", socket.id, true);
				if(customProperties[RED.util.getMessageProperty(msg,"socketIOId")]!= null){
					RED.util.setMessageProperty(msg, "socketIOStaticProperties", customProperties[RED.util.getMessageProperty(msg,"socketIOId")], true);
				}
				node.send(msg);
				});
		}
		
		io.on('connection', function(socket){
			//node.log("New connection");
			node.rules.forEach(function(val, i){
				addListener(socket, val, i);
			});
			//Adding support for all other special messages
			node.specialIOEvent.forEach(function(val, i){
				addListener(socket, val, i);
			});
		});
		
	}
	
	function socketIoOut(n) {
		RED.nodes.createNode(this,n);
		// node-specific code goes here
		var node = this;
		this.name = n.name;
		this.server = RED.nodes.getNode(n.server);
		
		node.on('input', function(msg) {
		// do something with 'msg'
			//node.log("Ecoing message");
			//console.log(customProperties);
			//console.log(customProperties[RED.util.getMessageProperty(msg,"socketIOId")]);
			/*console.log(io.sockets.sockets[RED.util.getMessageProperty(msg,"socketIOId")]);
			if(Object.prototype.toString.call(io.sockets.sockets[RED.util.getMessageProperty(msg,"socketIOId")]) === '[object Array]')
			{
				console.log("io.sockets.sockets is an array!! urray!!");
			}
			else
			{
				console.log("io.sockets.sockets is NOT an array!");
				console.log(Object.prototype.toString.call(io.sockets.sockets[RED.util.getMessageProperty(msg,"socketIOId")]));
			}*/
			//check if we need to add properties
			if(RED.util.getMessageProperty(msg,"socketIOAddStaticProperties"))
			{
				//check if we have already added some properties for this socket
				if(customProperties[RED.util.getMessageProperty(msg,"socketIOId")]!= null){
					//check if object as property
					var keys = Object.getOwnPropertyNames(RED.util.getMessageProperty(msg,"socketIOAddStaticProperties"));
					//console.log(keys);
					var tmp = customProperties[RED.util.getMessageProperty(msg,"socketIOId")];
					for(var i = 0; i < keys.length; i++){
						tmp[keys[i]] = RED.util.getMessageProperty(msg,"socketIOAddStaticProperties")[keys[i]];
					}
					//console.log("-After add or modify-");
					//console.log(customProperties);
					//console.log("---------------------");
				}
				else{
					//add new properties
					customProperties[RED.util.getMessageProperty(msg,"socketIOId")] = RED.util.getMessageProperty(msg,"socketIOAddStaticProperties");
				}
			}
					
			switch(RED.util.getMessageProperty(msg,"socketIOEmit")) {
				case "broadcast.emit":
					//Return to all but the caller
					if(io.sockets.sockets[RED.util.getMessageProperty(msg,"socketIOId")]){
						io.sockets.sockets[RED.util.getMessageProperty(msg,"socketIOId")].broadcast.emit(msg.socketIOEvent , msg.payload);
					}
					//console.log("broadcast.emit");
					break;
				case "emit":
					//Return only to the caller
					if(io.sockets.sockets[RED.util.getMessageProperty(msg,"socketIOId")]){
						io.sockets.sockets[RED.util.getMessageProperty(msg,"socketIOId")].emit(msg.socketIOEvent , msg.payload);
					}
					//console.log("emit");
					break;
				default:
				//emit to all
				io.emit(msg.socketIOEvent , msg.payload);
				//console.log("io.emit");
			}
		});
		
	}
	
	

	RED.nodes.registerType("socketio-config",socketIoConfig);
	RED.nodes.registerType("socketio-in",socketIoIn);
	RED.nodes.registerType("socketio-out",socketIoOut);
}
