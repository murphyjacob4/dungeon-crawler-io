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
var movableEntities = {};
var roomCatalog = parseRooms("assets/map/rooms.json");
var rooms = {};
var map = {};
generateRooms(roomCatalog, rooms, map);
generateDoors(rooms, map);

function generateRooms(roomCatalog, rooms, map) {
	var room1 = createRoomFromCatalog(roomCatalog, "room1");
	var room2 = createRoomFromCatalog(roomCatalog, "room2");
	var room3 = createRoomFromCatalog(roomCatalog, "room3");
	var room1a = createRoomFromCatalog(roomCatalog, "room1");
	rooms[room1.id] = room1;
	rooms[room2.id] = room2;
	rooms[room3.id] = room3;
	rooms[room1a.id] = room1a;
	// later will be generated
	// each room is anchored at the bottom left
	// this map represents:
	//    ____________
	//   |            |
	// 1 | [1a][2][3] |
	// 0 | [1 ][2] .  |
	//   |____________|
	//      0   1  2
	map[0] = {
		0: {
			roomID: room1.id,
			width: 1,
			height: 1,
			segmentX: 0,
			segmentY: 0
		},
		1: {
			roomID: room1a.id,
			width: 1,
			height: 1,
			segmentX: 0,
			segmentY: 0
		}
	};
	map[1] = {
		0: {
			roomID: room2.id,
			width: 1,
			height: 2,
			segmentX: 0,
			segmentY: 0
		},
		1: {
			roomID: room2.id,
			width: 1,
			height: 2,
			segmentX: 0,
			segmentY: 1
		}
	};
	map[2] = {
		1: {
			roomID: room3.id,
			width: 1,
			height: 1,
			segmentX: 0,
			segmentY: 0
		}
	}
}

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
	var doorX, doorY, outputX, outputY;
	const outputPad = 40;
	var segmentCenter = getCenterOfRoomSegment(inRoom.width, inRoom.height, inRoomMapData.width, inRoomMapData.height, inRoomMapData.segmentX, inRoomMapData.segmentY);
	var outputSegmentCenter = getCenterOfRoomSegment(toRoom.width, toRoom.height, toRoomMapData.width, toRoomMapData.height, toRoomMapData.segmentX, toRoomMapData.segmentY);
	if (direction === "south" || direction === "north") {
		doorX = segmentCenter.x - defaultWallWidth / 2;
		outputX = outputSegmentCenter.x; // players are anchored at center
		if (direction === "south") {
			doorY = inRoom.height / 2 - defaultWallWidth;
			outputY = -toRoom.height / 2 + defaultWallWidth + outputPad;
		} else {
			doorY = -inRoom.height / 2;
			outputY = toRoom.height / 2 - defaultWallWidth - outputPad;
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
	inRoom.entities[doorID] = new Door(doorX, doorY, defaultWallWidth, defaultWallWidth, toRoom.id, outputX, outputY, direction);
}

function getCenterOfRoomSegment(width, height, mapWidth, mapHeight, segmentX, segmentY) {
	return new SAT.Vector(-width / 2 + segmentX * width / mapWidth + width / mapWidth / 2,
		height / 2 - segmentY * height / mapHeight - height / mapHeight / 2);
	}

	function createRoomFromCatalog(roomCatalog, name) {
		var roomTemplate = roomCatalog[name];
		if (roomTemplate.width == null || roomTemplate.height == null || roomTemplate.namespace == null || roomTemplate.walls == null || roomTemplate.name == null) {
			console.log("error parsing " + name + " from the template:");
			console.log(roomTemplate);
		}

		var wallTemplate = roomTemplate.walls;
		var entities = {};
		for (var wallID in wallTemplate) {
			if (wallID === "_generate_basic_") {
				createBasicWalls(entities, roomTemplate.width, roomTemplate.height);
			} else {
				var wall = wallTemplate[wallID];
				if (wall.x == null || wall.y == null || wall.width == null || wall.height == null) {
					console.log("error parsing " + name + " wall " + wallID + ":");
					console.log(wall);
				}
				entities[wallID] = new Wall(wall.x, wall.y, wall.width, wall.height);
			}
		}

		var roomID = name + "-" + uuidv4();
		var namespace = "/" + roomID;

		return new Room(roomID, roomTemplate.width, roomTemplate.height, namespace, entities);
	}

	// Parses the given file at 'location' as a rooms JSON file and returns an object filled with room data
	function parseRooms(location) {
		var content = fs.readFileSync(location);
		var parsedRooms = JSON.parse(content);
		return parsedRooms;
	}

	io.on('connection', function (socket) {
		// notify client of its id
		socket.emit('client id', socket.id);

		// new player function called when client wishes to create a player
		socket.on('new player', function (user) {
			// if there is not a player already created
			if (!movableEntities[socket.id]) {
				// truncate the name if needed
				if (!user) {
					user = "Anonymous";
				}
				if (user.length > 13) {
					user = user.substring(0, 10);
					user = user + "...";
				}
				// determine the room and create the player
				var roomID = map[0][0].roomID;
				new Player(0, 0, socket, user, rooms[roomID]);
				console.log('player ' + socket.id + ' connected');
			}
		});

		// movement function called when client has a change in the movement.
		socket.on('movement', function (movement) {
			var player = movableEntities[socket.id] || {};
			// change the acceleration to be the vector in the direction of
			// movement with length accelerationSpeed
			player.acceleration = new SAT.Vector(movement.x, movement.y).
			normalize().scale(player.accelerationSpeed);
		});

		socket.on('attack', function (direction) {
			var player = movableEntities[socket.id];

		});

		// called on player disconnect
		socket.on('disconnect', function () {
			// get the player and determine if we knew of this player
			var player = movableEntities[socket.id];
			if (player) {
				console.log('player ' + player.id + ' disconnected');
				var room = rooms[player.roomID];
				// remove the player from the room
				removePlayerFromRoom(player, room);
				delete movableEntities[player.id];
			}
		});
	});

	// Our game loop
	setInterval(function () {
		// loop through all players
		for (var id in movableEntities) {
			// get the player
			var entity = movableEntities[id];
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
				for (var otherID in room.entities) {
					var other = room.entities[otherID];
					var colided = false;
					if (entity.collider instanceof SAT.Circle && other.collider instanceof SAT.Circle) {
						colided = SAT.testCircleCircle(entity.collider, room.entities[otherID].collider, response);
					} else if (entity.collider instanceof SAT.Circle && other.collider instanceof SAT.Polygon) {
						colided = SAT.testCirclePolygon(entity.collider, room.entities[otherID].collider, response);
					} else if (entity.collider instanceof SAT.Polygon && other.collider instanceof SAT.Circle) {
						colided = SAT.testPolygonCircle(entity.collider, room.entities[otherID].collider, response);
					} else if (entity.collider instanceof SAT.Polygon && other.collider instanceof SAT.Polygon) {
						colided = SAT.testPolygonPolygon(entity.collider, room.entities[otherID].collider, response);
					}
					if (colided) {
						entity.position.sub(response.overlapV);
						entity.collide(other);
						other.collide(entity);
					}
					response.clear();
				}

				// tell the room the player has changed position
				namespaces[entity.roomID].emit('update entity position', entity);
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
		namespaces[currentRoom.id].emit('remove entity', player);
		delete currentRoom.entities[player.id];
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

		this.renderStyle = {
			shape: "circle",
			radius: this.radius,
			fillColor: 0xff7a7a,
			lineColor: 0xf75656,
			lineThickness: 6
		}

		this.changeRoom = function (toRoom, fromRoom, direction, outputX, outputY) {
			toRoom.entities[this.id] = this;
			this.roomID = toRoom.id;
			transition = {
				"room": toRoom,
				"direction": direction
			}
			if (fromRoom) {
				removePlayerFromRoom(this, fromRoom);
			}
			this.position.x = outputX;
			this.position.y = outputY;
			namespaces[toRoom.id].emit('add entity', this);
			socket.emit('room change', transition);
		}

		this.collide = function (other) {
			// do nothing on collision yet
		}

		this.changeRoom(room);
		movableEntities[this.id] = this;
	}

	// Wall object constructor
	function Wall(x, y, width, height) {
		this.position = new SAT.Vector(x, y);
		this.width = width;
		this.height = height;
		this.collider = new SAT.Box(this.position, this.width, this.height).toPolygon();

		this.renderStyle = {
			shape: "rectangle",
			width: this.width,
			height: this.height,
			fillColor: 0x8c8c8c,
			lineColor: 0x8c8c8c,
			lineThickness: 0
		}

		this.collide = function (other) {
			// do nothing on collision
		}
	}

	// Door object constructor
	function Door(x, y, width, height, roomID, outputX, outputY, direction) {
		this.position = new SAT.Vector(x, y);
		this.width = width;
		this.height = height;
		this.outputX = outputX;
		this.outputY = outputY;
		this.roomID = roomID;
		this.direction = direction;
		this.open = true;
		this.collider = new SAT.Box(this.position, this.width, this.height).toPolygon();

		this.renderStyle = {
			shape: "rectangle",
			width: this.width,
			height: this.height,
			fillColor: 0x874500,
			lineColor: 0x874500,
			lineThickness: 0
		}

		this.collide = function (other) {
			if (other.changeRoom != null) {
				other.changeRoom(rooms[roomID], rooms[other.roomID], direction, outputX, outputY);
			}
		}
	}

	// Room object constructor
	function Room(roomID, width, height, namespace, entities) {
		this.id = roomID;
		this.namespace = namespace;
		this.width = width;
		this.height = height;
		this.entities = entities;
		namespaces[roomID] = io.of(namespace);
	}

	function uuidv4() {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
			var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		});
	}
