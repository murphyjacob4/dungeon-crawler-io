var Game = {};

Game.init = function () {
    game.scale.scaleMode = Phaser.ScaleManager.RESIZE;
    game.scale.setResizeCallback(Game.resize);
};

Game.preload = function () {
	game.load.image('background', 'assets/map/grid.png');
};

var arrowKeys;
var wasdKeys = {};
var background;
var currentRoom;

Game.resize = function (scale, parentBounds) {
    var height = game.height;
    var width = game.width;
    if (currentRoom) {
        height = Math.max(height, currentRoom.height);
        width = Math.max(width, currentRoom.width);
    }
    game.world.setBounds(-width / 2, -height / 2, width, height);
}

Game.create = function () {
	Game.playerMap = {};
    Game.wallMap = {};
	Game.doorMap = {};
	background = game.add.tileSprite(-5000, -5000, 10000, 10000, 'background');
	Client.askNewPlayer(prompt("Please enter your username", "Anonymous"));
	arrowKeys = game.input.keyboard.createCursorKeys();
	wasdKeys.w = game.input.keyboard.addKey(Phaser.Keyboard.W);
	wasdKeys.a = game.input.keyboard.addKey(Phaser.Keyboard.A);
	wasdKeys.s = game.input.keyboard.addKey(Phaser.Keyboard.S);
	wasdKeys.d = game.input.keyboard.addKey(Phaser.Keyboard.D);
};

Game.changeRoom = function (transition) {
	var direction = transition.direction;
	var oldRoom = currentRoom;
	currentRoom = transition.room;
	if (oldRoom) {
		for (var id in Game.playerMap) {
			delete Game.playerMap[id];
		}
		for (var id in Game.wallMap) {
			delete Game.wallMap[id];
		}
		for (var id in Game.doorMap) {
			delete Game.doorMap[id];
		}
		game.world.removeAll();
		background = game.add.tileSprite(-5000, -5000, 10000, 10000, 'background');
	}
	for (var id in currentRoom.players) {
		var player = currentRoom.players[id];
		Game.addNewPlayer(player.id, player.position.x, player.position.y, player.name);
	}
	for (var id in currentRoom.walls) {
		var wall = currentRoom.walls[id];
		Game.addNewWall(id, wall.position.x, wall.position.y, wall.width, wall.height);
	}
	for (var id in currentRoom.doors) {
		var door = currentRoom.doors[id];
		Game.addNewDoor(id, door.position.x, door.position.y, door.width, door.height);
	}
	Game.resize();
}

Game.getMovement = function () {
	var vector = {
		x: 0,
		y: 0
	}
	if (arrowKeys && wasdKeys) {
		if (arrowKeys.left.isDown || wasdKeys.a.isDown) {
			vector.x -= 1;
		}
		if (arrowKeys.right.isDown || wasdKeys.d.isDown) {
			vector.x += 1;
		}
		if (arrowKeys.down.isDown || wasdKeys.s.isDown) {
			vector.y += 1;
		}
		if (arrowKeys.up.isDown || wasdKeys.w.isDown) {
			vector.y -= 1;
		}
	}
	return vector;
};

Game.addNewPlayer = function (id, x, y, name) {
    Game.playerMap[id] = game.add.graphics(x, y);
    if (Game.thisPlayer === id) {
        game.camera.follow(Game.playerMap[id]);
        Game.playerMap[id].beginFill(0x609dff);
        Game.playerMap[id].lineStyle(6, 0x4c90ff, 1);
    } else {
        Game.playerMap[id].beginFill(0xff7a7a);
        Game.playerMap[id].lineStyle(6, 0xf75656, 1);
    }
	Game.playerMap[id].arc(0, 0, 30, 0, Math.PI * 2, false, 100);
    Game.playerMap[id].endFill();
    if (Game.thisPlayer === id) {
        GUI.user = name;
        GUI.update();
    } else {
        var style = { font: "25px Ubuntu", fontWeight: "bold", stroke: "#282828", strokeThickness: 4, fill: "white", align: "center" };
        var text = game.add.text(0, 40, name, style);
        text.anchor.set(0.5, 0);
        Game.playerMap[id].addChild(text);
    }
};

Game.addNewWall = function (id, x, y, width, height) {
	Game.wallMap[id] = game.add.graphics(x, y);
    Game.wallMap[id].beginFill(0x8c8c8c);
	Game.wallMap[id].drawRect(0, 0, width, height);
	Game.wallMap[id].endFill();
}

Game.addNewDoor = function (id, x, y, width, height) {
    Game.doorMap[id] = game.add.graphics(x, y);
    Game.doorMap[id].beginFill(0x874500);
    Game.doorMap[id].drawRect(0, 0, width, height);
    Game.doorMap[id].endFill();
}

Game.updatePosition = function (id, x, y) {
	if (Game.playerMap && Game.playerMap[id]) {
        var player = Game.playerMap[id];
        player.x = x;
        player.y = y;
	}
}

Game.removePlayer = function (id) {
    if (Game.playerMap[id]) {
        Game.playerMap[id].destroy();
        delete Game.playerMap[id];
    }
};
var movementLast;
Game.update = function () {
    var thisMovement = Game.getMovement();
    if (!movementLast || thisMovement !== movementLast) {
        Client.sendMovement(thisMovement);
        movementLast = thisMovement;
	}
}

// detect if the user clicks off page, if so stop their movement
$(window).blur(function () {
    Client.sendMovement({x:0, y:0});
})