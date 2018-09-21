var Client = {};
Client.socket = io.connect();

Client.askNewPlayer = function (user) {
	Client.socket.emit('new player', user);
};

Client.socket.on('client id', function (id) {
    console.log('my client id is ' + id);
	Game.thisPlayer = id;
});

Client.socket.on('room change', function (room) {
    Game.changeRoom(room);
    if (Client.roomSocket) {
        Client.roomSocket.disconnect();
    }
    Client.roomSocket = io(room.namespace);
    Client.roomSocket.on('add player', function (player) {
        console.log("room: " + room.id + ", add player " + player.id);
        Game.addNewPlayer(player.id, player.position.x, player.position.y, player.name);
    });

    Client.roomSocket.on('update position', function (player) {
        console.log("room: " + room.id + ", update position " + player.id);
        Game.updatePosition(player.id, player.position.x, player.position.y);
    });

    Client.roomSocket.on('remove player', function (player) {
        console.log("room: " + room.id + ", remove player " + player.id);
        Game.removePlayer(player.id);
    });
});

Client.sendMovement = function (vector) {
	Client.socket.emit('movement', vector);
};