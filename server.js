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

server.listen(process.env.PORT || 8081, function () {
	console.log('Listening on ' + server.address().port);
});

const defaultWallWidth = 80;
var namespaces = {};
var movableEntities = {};
var enemies = {};
var roomCatalog = parseRooms("assets/map/rooms.json");
var rooms = {};
var map = {};
generateRooms(roomCatalog, rooms, map);
generateDoors(rooms, map);

function generateRooms(roomCatalog, rooms, map) {
	var room1 = createRoomFromCatalog(roomCatalog, 1);
	var room2 = createRoomFromCatalog(roomCatalog, 2);
	var room3 = createRoomFromCatalog(roomCatalog, 3);
	var room4 = createRoomFromCatalog(roomCatalog, 4);
	if (!room1 || !room2 || !room3 || !room4) {
		console.log("cannot create rooms");
		return;
	}
	rooms[room1.id] = room1;
	rooms[room2.id] = room2;
	rooms[room3.id] = room3;
	rooms[room4.id] = room4;
	// later will be generated
	// each room is anchored at the bottom left
	// this map represents:
	//    ___________
	//   |           |
	// 1 | [2][3][4] |
	// 0 | [1][3]    |
	//   |___________|
	//      0  1  2
	map[0] = {
		0: {
			roomID: room1.id,
			width: 1,
			height: 1,
			segmentX: 0,
			segmentY: 0
		},
		1: {
			roomID: room2.id,
			width: 1,
			height: 1,
			segmentX: 0,
			segmentY: 0
		}
	};
	map[1] = {
		0: {
			roomID: room3.id,
			width: 1,
			height: 2,
			segmentX: 0,
			segmentY: 0
		},
		1: {
			roomID: room3.id,
			width: 1,
			height: 2,
			segmentX: 0,
			segmentY: 1
		}
	};
	map[2] = {
		1: {
			roomID: room4.id,
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

function createRoomFromCatalog(roomCatalog, id) {
	// search the array of rooms for the corresponding id
	var roomTemplate;
	for (var i = 0; i < roomCatalog.length; i++) {
		var template = roomCatalog[i];
		if (template.id === id) {
			roomTemplate = template;
			break;
		}
	}
	// if we couldn't find it, return null
	if (!roomTemplate) {
		console.log("could not find room with id " + id)
		console.log(roomCatalog);
		return null;
	}
	// if the room teplate is malformed, return null
	if (roomTemplate.width == null || roomTemplate.height == null || roomTemplate.walls == null) {
		console.log("error parsing " + id + " from the template:");
		console.log(roomTemplate);
		return null;
	}

	var entities = {};

	// get the walls and parse them into entities
	var wallTemplate = roomTemplate.walls;
	for (var i = 0; i < wallTemplate.length; i++) {
		var wall = wallTemplate[i];
		// determine the wall type
		if (wall.type === "basic") {
			createBasicWalls(entities, roomTemplate.width, roomTemplate.height);
		} else if (wall.type === "custom") {
			// if the custom wall is malformed, return null
			if (wall.x == null || wall.y == null || wall.width == null || wall.height == null) {
				console.log("error parsing " + id + " custom wall:");
				console.log(wall);
				return null;
			}
			entities[uuidv4()] = new Wall(wall.x, wall.y, wall.width, wall.height);
		} else {
			// we couldn't find the wall type, return null
			console.log("unknown wall type: " + wall.type);
			return null
		}
	}


	// generate a roomID and namespace based on that id
	var roomID = id + "-" + uuidv4();
	var namespace = "/" + roomID;

	// return a new room
	var completedRoom = new Room(roomID, roomTemplate.width, roomTemplate.height, namespace, entities);

	var entitySpawns = roomTemplate.enemy_spawns;
	var entityTypes = roomTemplate.enemy_types;
	for (var i = 0; i < entitySpawns.length; i++) {
		var entitySpawn = entitySpawns[i];
		var entityType = entityTypes[Math.floor(Math.random() * entityTypes.length)];
		if (entityType === "zombie") {
			var zombieID = "zombie-" + uuidv4();
			completedRoom.entities[zombieID] = new Zombie(entitySpawn.x, entitySpawn.y, completedRoom, zombieID);
		}
	}

	return completedRoom;
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
		if (player.canMove) {
			player.moveAcceleration = new SAT.Vector(movement.x, movement.y).normalize().scale(player.moveAccelerationSpeed);
		} else {
			player.moveAcceleration = new SAT.Vector(0, 0);
		}
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
			removeEntityFromRoom(player, room);
			delete movableEntities[player.id];
		}
	});
});

// Our game loop
setInterval(function () {
	for (var id in enemies) {
		var enemy = enemies[id];
		enemy.tick();
	}
	// loop through all players
	for (var id in movableEntities) {
		// get the player
		var entity = movableEntities[id];

		// add the acceleration to the velocity
		entity.moveVelocity.x += entity.moveAcceleration.x;
		entity.moveVelocity.y += entity.moveAcceleration.y;
		entity.envVelocity.x += entity.envAcceleration.x;
		entity.envVelocity.y += entity.envAcceleration.y;

		// if the object doesn't need to move don't continue
		if (entity.moveVelocity.x !== 0 || entity.moveVelocity.y !== 0 || entity.envVelocity.x !== 0 || entity.envVelocity.y !== 0) {
			// if the velocity is greater than the maxspeed and the player is moving (via acceleration), adjust it
			if (entity.moveVelocity.len2() > entity.maxMoveSpeed * entity.maxMoveSpeed) {
				entity.moveVelocity.normalize().scale(entity.maxMoveSpeed);
			}
			// reduce velocity if no acceleration is occuring (drag)
			if (entity.moveAcceleration.x === 0) {
				entity.moveVelocity.x *= 0.9;
				if (Math.abs(entity.moveVelocity.x) < 0.01) {
					entity.moveVelocity.x = 0;
				}
			}
			if (entity.moveAcceleration.y === 0) {
				entity.moveVelocity.y *= 0.9;
				if (Math.abs(entity.moveVelocity.y) < 0.01) {
					entity.moveVelocity.y = 0;
				}
			}
			if (entity.envAcceleration.x === 0) {
				entity.envVelocity.x *= 0.9;
				if (Math.abs(entity.envVelocity.x) < 0.01) {
					entity.envVelocity.x = 0;
				}
			}
			if (entity.envAcceleration.y === 0) {
				entity.envVelocity.y *= 0.9;
				if (Math.abs(entity.envVelocity.y) < 0.01) {
					entity.envVelocity.y = 0;
				}
			}

			// add the velocity to the position
			entity.position.x += entity.moveVelocity.x;
			entity.position.y += entity.moveVelocity.y;
			entity.position.x += entity.envVelocity.x;
			entity.position.y += entity.envVelocity.y;

			// adjust position for collisions
			var response = new SAT.Response().clear();
			var room = rooms[entity.roomID];
			for (var otherID in room.entities) {
				if (otherID != entity.id) {
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
						entity.collide(other, response);
						response.overlapV = response.overlapV.reverse();
						other.collide(entity, response);
					}
					response.clear();
				}
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

function removeEntityFromRoom(entity, currentRoom) {
	// inform the room the player is leaving
	namespaces[currentRoom.id].emit('remove entity', entity);
	delete currentRoom.entities[entity.id];
}

function Player(x, y, socket, user, room) {
	this.position = new SAT.Vector(x, y);
	this.moveVelocity = new SAT.Vector(0, 0);
	this.moveAcceleration = new SAT.Vector(0, 0);
	this.envVelocity = new SAT.V(0,0);
	this.envAcceleration = new SAT.V(0,0);
	this.radius = 30;
	this.moveAccelerationSpeed = 3;
	this.maxMoveSpeed = 5;
	this.name = user;
	this.id = socket.id;
	this.roomID = room.id;
	this.collider = new SAT.Circle(this.position, this.radius);
	this.bodyDamage = 2;
	this.maxHealth = 10;
	this.health = this.maxHealth;
	this.canMove = true;
	this.gracePeriod = 500;
	this.canBeDamaged = true;
	this.knockback = 10;

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
			removeEntityFromRoom(this, fromRoom);
			this.position.x = outputX;
			this.position.y = outputY;
		}
		namespaces[toRoom.id].emit('add entity', this);
		socket.emit('room change', transition);
	}

	this.collide = function (other, response) {
		// do nothing on collision yet
		if (other.damage != null) {
			console.log("damaging other")
			other.damage(this.bodyDamage, response.overlapV, this.knockback);
		}
	}

	this.damage = function (amount, knockbackDirection, knockbackIntensity) {
		if (this.canBeDamaged) {
			ApplyKnockback(this, knockbackDirection, knockbackIntensity);
			this.health -= amount;
			var socket
			namespaces[this.roomID].emit('update health', this)
			if (this.health <= 0) {
				namespaces[this.roomID].emit('death', this);
				removeEntityFromRoom(this, rooms[this.roomID]);
				delete movableEntities[this.id];
			} else {
				this.canBeDamaged = false;
				setTimeout(function (id) {movableEntities[id].canBeDamaged = true}, this.gracePeriod, this.id);
			}
		}
	}

	this.changeRoom(room);
	movableEntities[this.id] = this;
	socket.emit('update health', this);
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

	this.collide = function (other, response) {
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

	this.collide = function (other, response) {
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

function Zombie(x, y, room, id) {
	this.spawnPosition = new SAT.Vector(x, y);
	this.position = new SAT.Vector(x, y);
	this.moveVelocity = new SAT.Vector(0, 0);
	this.moveAcceleration = new SAT.Vector(0, 0);
	this.envVelocity = new SAT.V(0,0);
	this.envAcceleration = new SAT.V(0,0);
	this.moveAccelerationSpeed = 3;
	this.maxMoveSpeed = 2;
	this.width = 64;
	this.height = 64;
	this.collider = new SAT.Box(this.position, this.width, this.height).toPolygon();
	this.collider.pos = this.position; // needed because toPolygon copies position and will not update on movement
	this.roomID = room.id;
	this.id = id;
	this.bodyDamage = 2;
	this.maxHealth = 10;
	this.health = this.maxHealth;
	this.canMove = true;
	this.gracePeriod = 500;
	this.canBeDamaged = true;
	this.knockback = 10;

	this.renderStyle = {
		shape: "rectangle",
		width: this.width,
		height: this.height,
		fillColor: 0x33cc33,
		lineColor: 0x009933,
		lineThickness: 6
	}

	this.collide = function (other, response) {
		// modify other's health
		// set other's velocity to simulate knockback
		if (other instanceof Player) {
			other.damage(this.bodyDamage, response.overlapV, this.knockback);
		}
	}

	this.tick = function () {
		if (this.canMove) {
			var target = null;
			var targetVectorTo
			for (var entityID in rooms[room.id].entities) {
				var entity = rooms[room.id].entities[entityID];
				if (entity instanceof Player) {
					if (target) {
						var vectorTo = new SAT.Vector(target.position.x - (this.position.x + 32), target.position.y - (this.position.y + 32));
						if (vectorTo.len2() < targetVectorTo.len2()) {
							target = entity;
							targetVectorTo = vectorTo;
						}
					} else {
						target = entity;
						targetVectorTo = new SAT.Vector(target.position.x - (this.position.x + 32), target.position.y - (this.position.y + 32));
					}
				}
			}

			if (target) {
				this.moveAcceleration = targetVectorTo.normalize().scale(this.moveAccelerationSpeed);
			} else if (this.moveAcceleration.x != 0 || this.moveAcceleration.y != 0 || this.position.x != this.spawnPosition.x || this.position.y != this.spawnPosition.y) {
				// reset back to the starting point for next player
				this.moveAcceleration.x = 0;
				this.moveAcceleration.y = 0;
				this.moveVelocity.x = 0;
				this.moveVelocity.y = 0
				this.envAcceleration.x = 0;
				this.envAcceleration.y = 0;
				this.envVelocity.x = 0;
				this.envVelocity.y = 0;
				this.position.x = this.spawnPosition.x;
				this.position.y = this.spawnPosition.y;
				this.health = this.maxHealth;
				namespaces[this.roomID].emit('update health', this)
			}
		} else {
			this.moveAcceleration = new SAT.Vector(0,0);
		}
	}

	this.damage = function (amount, knockbackDirection, knockbackIntensity) {
		if (this.canBeDamaged) {
			ApplyKnockback(this, knockbackDirection, knockbackIntensity);
			this.health -= amount;
			var socket
			namespaces[this.roomID].emit('update health', this)
			if (this.health <= 0) {
				namespaces[this.roomID].emit('death', this);
				removeEntityFromRoom(this, rooms[this.roomID]);
				delete enemies[this.id];
				delete movableEntities[this.id];
			} else {
				this.canBeDamaged = false;
				setTimeout(function (id) {movableEntities[id].canBeDamaged = true}, this.gracePeriod, this.id)
			}
		}
	}

	enemies[id] = this;
	movableEntities[id] = this;
	namespaces[this.roomID].emit('add entity', this)
}

function ApplyKnockback(other, direction, intensity) {
	var velV = direction.normalize().scale(intensity);
	other.envVelocity.x = velV.x;
	other.envVelocity.y = velV.y;
}

function uuidv4() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}
