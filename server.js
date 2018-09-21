var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io').listen(server);
var SAT = require('sat');
var fs = require('fs');

app.use('/css', express.static(__dirname + '/css'));
app.use('/js', express.static(__dirname + '/js'));
app.use('/assets', express.static(__dirname + '/assets'));

app.get('/', function (req, res) {
	res.sendFile(__dirname + '/index.html');
});

server.lastPlayderID = 0;

server.listen(process.env.PORT || 8081, function () {
	console.log('Listening on ' + server.address().port);
});

const defaultWallWidth = 80;
var namespaces = {};
var entities = {};
var rooms = parseRooms("assets/map/rooms.json");
var wall = new Wall(1, 2, 3, 4);
// later will be generated
// each room is anchored at the bottom left
// this map represents:
//    ________
//   |        |
// 1 |  . [2] |
// 0 | [1][2] |
//   |________|
//      0  1
var map = {
    0: {
        0: {
            roomID: "room1",
            width: 1,
            height: 1,
            segmentX: 0,
            segmentY: 0
        }
    },
    1: {
        0: {
            roomID: "room2",
            width: 1,
            height: 2,
            segmentX: 0,
            segmentY: 0
        },
        1: {
            roomID: "room2",
            width: 1,
            height: 2,
            segmentX: 0,
            segmentY: 1
        }
    }
}
generateDoors(rooms, map);

function generateDoors(rooms, map) {
    for (var x in map) {
        var x = parseInt(x);
        for (var y in map[x]) {
            var y = parseInt(y);
            var data = map[x][y];
            var room = rooms[data.roomID];
            if (map[x][y + 1] != null && map[x][y + 1].roomID !== data.roomID) {
                addDoor("north", data, map[x][y + 1]);
            }
            if (map[x][y - 1] != null && map[x][y - 1].roomID !== data.roomID) {
                addDoor("south", data, map[x][y - 1]);
            }
            if (map[x - 1] != null && map[x - 1][y] != null && map[x - 1][y].roomID !== data.roomID) {
                addDoor("east", data, map[x - 1][y]);
            }
            if (map[x + 1] != null && map[x + 1][y] != null && map[x + 1][y].roomID !== data.roomID) {
                addDoor("west", data, map[x + 1][y]);
            }
        }
    }
}

function addDoor(direction, inRoomMapData, toRoomMapData) {
    var inRoom = rooms[inRoomMapData.roomID];
    var toRoom = rooms[toRoomMapData.roomID];
    var doorID = direction + "-" + inRoomMapData.segmentX + "-" + inRoomMapData.segmentY + "-" + toRoom.id;
    console.log(doorID);
    var doorX, doorY, outputX, outputY;
    const outputPad = 40;
    var segmentCenter = getCenterOfRoomSegment(inRoom.width, inRoom.height, inRoomMapData.width, inRoomMapData.height, inRoomMapData.segmentX, inRoomMapData.segmentY);
    console.log(segmentCenter);
    var outputSegmentCenter = getCenterOfRoomSegment(toRoom.width, toRoom.height, toRoomMapData.width, toRoomMapData.height, toRoomMapData.segmentX, toRoomMapData.segmentY);
    console.log(outputSegmentCenter);
    if (direction === "south" || direction === "north") {
        doorX = segmentCenter.x - defaultWallWidth / 2;
        outputX = outputSegmentCenter.x; // players are anchored at center
        if (direction === "south") {
            doorY = inRoom.height / 2 - defaultWallWidth;
            outputY = -toRoom.height / 2 + defaultWallWidth + outputPad;
        } else {
            doorY = -inRoom.height / 2;
            outputY = toRoom.height / 2 - defaultWallWidth + outputPad;
        }
    } else {
        doorY = segmentCenter.y - defaultWallWidth / 2;
        outputY = outputSegmentCenter.y;
        if (direction === "east") {
            doorX = -inRoom.width / 2;
            outputX = inRoom.width / 2 - defaultWallWidth - outputPad;
        } else {
            doorX = inRoom.width / 2 - defaultWallWidth;
            outputX = -inRoom.width / 2 + defaultWallWidth + outputPad;
        }
    }
    console.log(outputX + " " + outputY);
    inRoom.doors[doorID] = new Door(doorX, doorY, defaultWallWidth, defaultWallWidth, toRoom.id, outputX, outputY);
}

function getCenterOfRoomSegment(width, height, mapWidth, mapHeight, segmentX, segmentY) {
    return new SAT.Vector(-width / 2 + segmentX * width / mapWidth + width / mapWidth / 2,
        height / 2 - segmentY * height / mapHeight - height / mapHeight / 2);
}

// Parses the given file at 'location' as a rooms JSON file and returns an object filled with room data
function parseRooms(location) {
    var content = fs.readFileSync(location);
    var parsedRooms = JSON.parse(content);
    var result = {};
    for (var roomID in parsedRooms) {
        var parsedRoom = parsedRooms[roomID];
        if (parsedRoom.width == null || parsedRoom.height == null || parsedRoom.namespace == null || parsedRoom.walls == null) {
            console.log("error parsing " + roomID);
            console.log(parsedRoom);
        }

        var parsedWalls = parsedRoom.walls;
        var resultWalls = {};
        for (var wallID in parsedWalls) {
            if (wallID === "_generate_basic_") {
                createBasicWalls(resultWalls, parsedRoom.width, parsedRoom.height);
            } else {
                var parsedWall = parsedWalls[wallID];
                if (parsedWall.x == null || parsedWall.y == null || parsedWall.width == null || parsedWall.height == null) {
                    console.log("error parsing " + roomID + " wall " + wallID);
                    console.log(parsedWall);
                }
                resultWalls[wallID] = new Wall(parsedWall.x, parsedWall.y, parsedWall.width,
                    parsedWall.height);
            }
        }

        result[roomID] = new Room(roomID, parsedRoom.width, parsedRoom.height, parsedRoom.namespace, resultWalls);
    }
    return result;
}

io.on('connection', function (socket) {
    // notify client of its id
    socket.emit('client id', socket.id);

    // new player function called when client wishes to create a player
    socket.on('new player', function (user) {
        // if there is not a player already created
        if (!entities[socket.id]) {
            // truncate the name if needed
            if (!user) {
                user = "Anonymous";
            }
            if (user.length > 13) {
                user = user.substring(0, 10);
                user = user + "...";
            }
            // determine the room and create the player
            var roomID = "room1";
            entities[socket.id] = new Player(0, 0, socket, user, rooms[roomID]);
            console.log('player ' + socket.id + ' connected');
        }
    });

    // movement function called when client has a change in the movement.
	socket.on('movement', function (movement) {
        var player = entities[socket.id] || {};
        // change the acceleration to be the vector in the direction of 
        // movement with length accelerationSpeed
        player.acceleration = new SAT.Vector(movement.x, movement.y).
            normalize().scale(player.accelerationSpeed);
    });

    // called on player disconnect
    socket.on('disconnect', function () {
        // get the player and determine if we knew of this player
        var player = entities[socket.id];
        if (player) {
            console.log('player ' + player.id + ' disconnected');
            var room = rooms[player.roomID];
            // remove the player from the room
            removePlayerFromRoom(player, room);
			delete entities[player.id];
		}
	});
});

// Our game loop
setInterval(function () {
    // loop through all players
    for (var id in entities) {
        // get the player
        var entity = entities[id];
        // add the acceleration to the velocity
		entity.velocity.x += entity.acceleration.x;
        entity.velocity.y += entity.acceleration.y;
        // if the object doesn't need to move don't continue
        if (entity.velocity.x !== 0 || entity.velocity.y !== 0) {
            // if the velocity is greater than the maxspeed, adjust it
			if (entity.velocity.len2() > entity.maxSpeed * entity.maxSpeed) {
				entity.velocity.normalize().scale(entity.maxSpeed);
            }
            // reduce velocity if no acceleration is occuring (drag)
			if (entity.acceleration.x === 0) {
				entity.velocity.x *= 0.9;
				if (Math.abs(entity.velocity.x) < 0.01) {
					entity.velocity.x = 0;
				}
			}
			if (entity.acceleration.y === 0) {
				entity.velocity.y *= 0.9;
				if (Math.abs(entity.velocity.y) < 0.01) {
					entity.velocity.y = 0;
				}
			}

            // add the velocity to the position
			entity.position.x += entity.velocity.x;
			entity.position.y += entity.velocity.y;

            // adjust position for collisions
            var response = new SAT.Response().clear();
            var room = rooms[entity.roomID];
            for (var otherID in room.doors) {
                if (entity instanceof Player && room.doors[otherID].open && 
                    SAT.testCirclePolygon(entity.collider, room.doors[otherID].collider, response)) {
                    entity.changeRoom(rooms[room.doors[otherID].roomID], room);
                    entity.position.x = room.doors[otherID].outputX;
                    entity.position.y = room.doors[otherID].outputY;
                    response.clear();
                    return;
                }
                response.clear();
            }
			for (var otherID in room.players) {
				if (otherID !== id) {
                    if (SAT.testCircleCircle(entity.collider,
                        room.players[otherID].collider, response)) {
						entity.position.sub(response.overlapV);
					}
					response.clear();
				}
			}
            for (var otherID in room.walls) {
                if (SAT.testCirclePolygon(entity.collider,
                    room.walls[otherID].collider, response)) {
					entity.position.sub(response.overlapV);
				}
				response.clear();
			}

            // tell the room the player has changed position
            namespaces[entity.roomID].emit('update position', entity);
		}
	}
}, 1000 / 60);

function createBasicWalls(walls, width, height) {
    walls["top_wall"] = new Wall(-width / 2, -height / 2, width, defaultWallWidth);
    walls["left_wall"] = new Wall(-width / 2, -height / 2, defaultWallWidth, height);
    walls["right_wall"] = new Wall(width / 2 - defaultWallWidth, -height / 2, defaultWallWidth, height);
    walls["bottom_wall"] = new Wall(-width / 2, height / 2 - defaultWallWidth, width, defaultWallWidth);
}

function removePlayerFromRoom(player, currentRoom) {
    // inform the room the player is leaving
    namespaces[currentRoom.id].emit('remove player', player);
    delete currentRoom.players[player.id];
}

function getRoomNamespaceFromPlayer(player) {
    return namespaces[player.roomID];
}

function Player(x, y, socket, user, room) {
    this.position = new SAT.Vector(x, y);
    this.velocity = new SAT.Vector(0, 0);
    this.acceleration = new SAT.Vector(0, 0);
    this.radius = 30;
    this.accelerationSpeed = 3;
    this.maxSpeed = 5;
    this.name = user;
    this.id = socket.id;
    this.roomID = room.id;
    this.collider = new SAT.Circle(this.position, this.radius);
    this.changeRoom = function (toRoom, fromRoom) {
        toRoom.players[this.id] = this;
        this.roomID = toRoom.id;
        socket.emit('room change', toRoom);
        namespaces[toRoom.id].emit('add player', this);
        if (fromRoom) {
            removePlayerFromRoom(this, fromRoom);
        }
    }
    this.changeRoom(room);
}

// Wall object constructor
function Wall(x, y, width, height) {
    this.position = new SAT.Vector(x, y);
    this.width = width;
    this.height = height;
    this.collider = new SAT.Box(this.position, this.width, this.height).toPolygon();
}

// Door object constructor
function Door(x, y, width, height, roomID, outputX, outputY) {
    this.position = new SAT.Vector(x, y);
    this.width = width;
    this.height = height;
    this.outputX = outputX;
    this.outputY = outputY;
    this.roomID = roomID;
    this.open = true;
    this.collider = new SAT.Box(this.position, this.width, this.height).toPolygon();
}

// Room object constructor
function Room(roomID, width, height, namespace, walls) {
    this.id = roomID;
    this.namespace = namespace;
    this.width = width;
    this.height = height;
    this.walls = walls;
    this.players = {};
    this.doors = {};
    namespaces[roomID] = io.of(namespace);
}