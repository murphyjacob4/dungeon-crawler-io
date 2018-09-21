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
    console.log("resizing to " + game.height + " , " + game.width);
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
	Client.askNewPlayer(prompt("Please enter your username", "Anonymous"));
	arrowKeys = game.input.keyboard.createCursorKeys();
	wasdKeys.w = game.input.keyboard.addKey(Phaser.Keyboard.W);
	wasdKeys.a = game.input.keyboard.addKey(Phaser.Keyboard.A);
	wasdKeys.s = game.input.keyboard.addKey(Phaser.Keyboard.S);
	wasdKeys.d = game.input.keyboard.addKey(Phaser.Keyboard.D);
};

Game.changeRoom = function (room) {
    currentRoom = room;
    console.log("changing room to " + room.id);
    Game.resize();
    Game.clear();
    game.world.removeAll();
    background = game.add.tileSprite(-5000, -5000, 10000, 10000, 'background');
    var players = room.players;
    Game.addNewPlayer(Game.thisPlayer, players[Game.thisPlayer].x, players[Game.thisPlayer].y, players[Game.thisPlayer].name);
    for (var id in players) {
        if (id !== Game.thisPlayer) {
            var player = players[id];
            Game.addNewPlayer(player.id, player.position.x, player.position.y, player.name);
        }
    }
    var walls = room.walls;
    for (var id in walls) {
        var wall = walls[id];
        Game.addNewWall(wall.id, wall.position.x, wall.position.y, wall.width, wall.height);
    }
    var doors = room.doors;
    for (var id in doors) {
        var door = doors[id];
        Game.addNewDoor(id, door.position.x, door.position.y, door.width, door.height);
    }
}

Game.clear = function () {
    if (Game.playerMap) {
        for (var id in Game.playerMap) {
            this.removePlayer(id);
        }
    }
    if (Game.wallMap) {
        for (var id in Game.wallMap) {
            var wall = Game.wallMap[id];
            wall.destroy();
            delete Game.wallMap[id];
        }
    }
    if (Game.doorMap) {
        for (var id in Game.doorMap) {
            var door = Game.doorMap[id];
            door.destroy();
            delete Game.doorMap[id];
        }
    }
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
    console.log("player " + id + "(" + name + ") entered the room at " + x + ", " + y);
    if (Game.thisPlayer === id) {
        console.log("following " + id);
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