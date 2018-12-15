var Client = {};
Client.socket = io.connect();

Client.askNewPlayer = function (user) {
	Client.socket.emit('new player', user);
};

Client.socket.on('client id', function (id) {
	Game.thisPlayer = id;
});

Client.socket.on('update health', function (entity) {
	Game.updateHealth(entity.id, entity.health, entity.maxHealth);
});

Client.socket.on('death', function (entity) {
	Game.registerDeath(entity.id);
})

Client.socket.on('room change', function (transition) {
	var room = transition.room;
	Game.changeRoom(transition);
  if (Client.roomSocket) {
      Client.roomSocket.disconnect();
  }
  Client.roomSocket = io(room.namespace);
  Client.roomSocket.on('add entity', function (entity) {
      Game.addNewEntity(entity.id, entity.position.x, entity.position.y, entity.renderStyle, entity.name, entity.health, entity.maxHealth);
  });

  Client.roomSocket.on('update entity position', function (entity) {
      Game.updatePosition(entity.id, entity.position.x, entity.position.y);
  });

	Client.roomSocket.on('update health', function (entity) {
		Game.updateHealth(entity.id, entity.health, entity.maxHealth);
	});

	Client.roomSocket.on('death', function (entity) {
		Game.registerDeath(entity.id);
	});

  Client.roomSocket.on('remove entity', function (entity) {
      Game.removeEntity(entity.id);
  });
});

Client.sendMovement = function (vector) {
	Client.socket.emit('movement', vector);
};
