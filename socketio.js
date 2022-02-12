/**
 * Copyright Gallimberti Telemaco 02/02/2017
 **/

module.exports = function(RED) {
  const { Server } = require("socket.io");
  var io;
  var customProperties = {};

  function socketIoConfig(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    this.port = n.port || 80;
    this.sendClient = n.sendClient;
    this.path = n.path || "/socket.io/";
	  if (!this.path.startsWith("/")) this.path = "/" + this.path
	  if (!this.path.endsWith("/")) this.path = this.path + "/"
    try {
      this.options = n.options ? JSON.parse(n.options) : {};
    } catch (error) {
      node.error("Socket.io cannot parse options");
      this.options = {};
    }
    this.bindToNode = !!n.bindToNode;
    
    this.options.serveClient = node.sendClient
    this.options.path = node.path
    node.log("Socket.io options: " + JSON.stringify(this.options))
    if (this.bindToNode) {
      httpserver = RED.nodes.getNode(n.server).server
      io = new Server(httpserver, this.options);
    } else {
      io = new Server(this.options);
      io.listen(node.port);
    }
    var bindOn = this.bindToNode
      ? "bound to Node-red port"
      : "on port " + this.port;
    node.log("Created server " + bindOn);

    node.on("close", function() {
      io.close();
    });
  }

  function socketIoIn(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    this.name = n.name;
    this.server = RED.nodes.getNode(n.server);
    this.rules = n.rules || [];

    io.on("connection", function(socket) {
      socket.removeAllListeners();
      socket.offAny();
	      
      socket.onAny(function(eName, data) {
        var msg = {};
        RED.util.setMessageProperty(msg, "payload", data, true);
        RED.util.setMessageProperty(msg, "socketIOEvent", eName, true);
        RED.util.setMessageProperty(msg, "socketIOId", socket.id, true);
        RED.util.setMessageProperty(msg, "socketIOHandshake", socket.handshake, true);
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
