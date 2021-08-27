/**
 * Copyright Gallimberti Telemaco 02/02/2017
 **/

module.exports = function(RED) {
  const { Server } = require("socket.io");
  var io;
  var customProperties = {};
  var sockets = [];

  function socketIoConfig(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    this.port = n.port || 80;
    this.sendClient = n.sendClient;
    this.path = n.path || "/socket.io";
    this.bindToNode = n.bindToNode || false;    
    this.corsOrigins = n.corsOrigins || "*";
    this.corsMethods = n.corsMethods.toUpperCase().split(",") || "GET,POST";
    this.enableCors = n.enableCors || false;

    node.log("socketIoConfig - CORS METHODS " + JSON.stringify(this.corsMethods));
    node.log("socketIoConfig - CORS ORIGINS " + JSON.stringify(this.corsOrigins));
    node.log("socketIoConfig - CORS METHODS " + JSON.stringify(this.enableCors));

    let corsOptions = {};
    
    if (this.enableCors) {
      corsOptions = {
        cors: {
          origin: this.corsOrigins,
          methods: this.corsMethods
        }
      };
    }

    if (this.bindToNode) {      
      io = new Server(RED.server, corsOptions);
    } else {            
      io = new Server(corsOptions);
      
      io.serveClient(node.sendClient);
      io.path(node.path);
      io.listen(node.port);
    }
    var bindOn = this.bindToNode
      ? "bind to Node-red port"
      : "on port " + this.port;
    node.log("Created server " + bindOn);

    node.on("close", function() {
      if (!this.bindToNode) {
        io.close();
      }
      sockets.forEach(function (socket) {
        node.log('disconnect:' + socket.id);
        socket.disconnect(true);
      });
      sockets = [];
    });
  }

  function socketIoIn(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    this.name = n.name;
    this.server = RED.nodes.getNode(n.server);
    this.rules = n.rules || [];

    this.specialIOEvent = [
	// Events emitted by the Manager:
      { v: "open" },
      { v: "error" },
	  { v: "close" },
	  { v: "ping" },
	  { v: "packet" },
	  { v: "reconnect_attempt" },
	  { v: "reconnect" },
	  { v: "reconnect_error" },
	  { v: "reconnect_failed" },
	  
	  // Events emitted by the Socket:
      { v: "connect" },
	  { v: "connect_error" },
      { v: "disconnect" }
    ];

    function addListener(socket, val, i) {
      socket.on(val.v, function(msgin) {
        var msg = {};
        RED.util.setMessageProperty(msg, "payload", msgin, true);
        RED.util.setMessageProperty(msg, "socketIOEvent", val.v, true);
        RED.util.setMessageProperty(msg, "socketIOId", socket.id, true);
        if (
          customProperties[RED.util.getMessageProperty(msg, "socketIOId")] !=
          null
        ) {
          RED.util.setMessageProperty(
            msg,
            "socketIOStaticProperties",
            customProperties[RED.util.getMessageProperty(msg, "socketIOId")],
            true
          );
        }
        node.send(msg);
      });
    }

    io.on("connection", function(socket) {
      sockets.push(socket);
      node.rules.forEach(function(val, i) {
        addListener(socket, val, i);
      });
      //Adding support for all other special messages
      node.specialIOEvent.forEach(function(val, i) {
        addListener(socket, val, i);
      });
    });
  }

  function socketIoOut(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    this.name = n.name;
    this.server = RED.nodes.getNode(n.server);

    node.on("input", function(msg) {
      //check if we need to add properties
      if (RED.util.getMessageProperty(msg, "socketIOAddStaticProperties")) {
        //check if we have already added some properties for this socket
        if (
          customProperties[RED.util.getMessageProperty(msg, "socketIOId")] !=
          null
        ) {
          //check if object as property
          var keys = Object.getOwnPropertyNames(
            RED.util.getMessageProperty(msg, "socketIOAddStaticProperties")
          );
          var tmp =
            customProperties[RED.util.getMessageProperty(msg, "socketIOId")];
          for (var i = 0; i < keys.length; i++) {
            tmp[keys[i]] = RED.util.getMessageProperty(
              msg,
              "socketIOAddStaticProperties"
            )[keys[i]];
          }
        } else {
          //add new properties
          customProperties[
            RED.util.getMessageProperty(msg, "socketIOId")
          ] = RED.util.getMessageProperty(msg, "socketIOAddStaticProperties");
        }
      }

	
      switch (RED.util.getMessageProperty(msg, "socketIOEmit")) {
        case "broadcast.emit":
          //Return to all but the caller
          if (
            io.sockets.sockets.get(RED.util.getMessageProperty(msg, "socketIOId"))
          ) {
            io.sockets.sockets.get(
              RED.util.getMessageProperty(msg, "socketIOId")
            ).broadcast.emit(msg.socketIOEvent, msg.payload);
          }
          break;
        case "emit":
          //Return only to the caller
          if (
            io.sockets.sockets.get(RED.util.getMessageProperty(msg, "socketIOId"))
          ) {
            io.sockets.sockets.get(
              RED.util.getMessageProperty(msg, "socketIOId")
            ).emit(msg.socketIOEvent, msg.payload);
          }
          break;
        case "room":
          //emit to all
          if (msg.room) {
            io.to(msg.room).emit(msg.socketIOEvent, msg.payload);
          }
          break;
        default:
          //emit to all
          io.emit(msg.socketIOEvent, msg.payload);
      }
    });
  }

  function socketIoJoin(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    this.name = n.name;
    this.server = RED.nodes.getNode(n.server);

    node.on("input", function(msg) {
      if (io.sockets.sockets.get(RED.util.getMessageProperty(msg, "socketIOId"))) {
        io.sockets.sockets.get(RED.util.getMessageProperty(msg, "socketIOId")).join(
          msg.payload.room
        );
        node.send(msg);
      }
    });
  }
  
  function socketIoRooms(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    this.name = n.name;
    this.server = RED.nodes.getNode(n.server);

    node.on("input", function(msg) {
      node.send({ payload: io.sockets.adapter.rooms });
    });
  }
  
  function socketIoLeave(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    this.name = n.name;
    this.server = RED.nodes.getNode(n.server);

    node.on("input", function(msg) {
      if (io.sockets.sockets.get(RED.util.getMessageProperty(msg, "socketIOId"))) {
        io.sockets.sockets.get(
          RED.util.getMessageProperty(msg, "socketIOId")
        ).leave(msg.payload.room);
      }
    });
  }

  RED.nodes.registerType("socketio-config", socketIoConfig);
  RED.nodes.registerType("socketio-in", socketIoIn);
  RED.nodes.registerType("socketio-out", socketIoOut);
  RED.nodes.registerType("socketio-join", socketIoJoin);
  RED.nodes.registerType("socketio-rooms", socketIoRooms);
  RED.nodes.registerType("socketio-leave", socketIoLeave);
};
