var Client = {};
Client.socket = io.connect();

Client.askNewPlayer = function (user) {
	Client.socket.emit('new player', user);
};

Client.socket.on('client id', function (id) {
	Game.thisPlayer = id;
});

Client.socket.on('room change', function (transition) {
	var room = transition.room;
	Game.changeRoom(transition);
    if (Client.roomSocket) {
        Client.roomSocket.disconnect();
    }
    Client.roomSocket = io(room.namespace);
    Client.roomSocket.on('add player', function (player) {
        Game.addNewPlayer(player.id, player.position.x, player.position.y, player.name);
    });

    Client.roomSocket.on('update position', function (player) {
        Game.updatePosition(player.id, player.position.x, player.position.y);
    });

    Client.roomSocket.on('remove player', function (player) {
        Game.removePlayer(player.id);
    });
});

Client.sendMovement = function (vector) {
	Client.socket.emit('movement', vector);
};