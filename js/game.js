var Game = {};

var scale;

Game.init = function () {
  game.scale.scaleMode = Phaser.ScaleManager.EXACT_FIT;
  game.scale.setResizeCallback(Game.resize);
  scale = game.height / 900;
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
  game.camera.width = width;
  game.camera.height = height;
  scale = height / 900;
  if (currentRoom) {
    height = Math.max(height, currentRoom.height * scale);
    width = Math.max(width, currentRoom.width * scale);
    game.world.setBounds(-width / 2, -height / 2, width, height);
  }
};

Game.create = function () {
  Game.entityMap = {};
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
    // cleanup all entities from old room
    for (var id in Game.entityMap) {
      delete Game.entityMap[id];
    }
    game.world.removeAll();

    // we have to add the background back though
    background = game.add.tileSprite(-5000, -5000, 10000, 10000, 'background');
  }

  // loop and add all entities from the new room
  for (var id in currentRoom.entities) {
    var entity = currentRoom.entities[id];
    Game.addNewEntity(entity.id, entity.position.x, entity.position.y, entity.renderStyle, entity.name, entity.health, entity.maxHealth);
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

Game.addNewEntity = function (id, x, y, renderStyle, name = null, health = null, maxHealth = null) {
  entity = game.add.graphics(x * scale, y * scale);
  Game.entityMap[id] = entity;
  if (Game.thisPlayer === id) {
    game.camera.follow(Game.entityMap[id]);
    entity.beginFill(0x609dff);
    entity.lineStyle(renderStyle.lineThickness * scale, 0x4c90ff, 1);
    GUI.user = name;
    GUI.update();
  } else {
    entity.beginFill(renderStyle.fillColor);
    entity.lineStyle(renderStyle.lineThickness * scale, renderStyle.lineColor, 1);
  }
  if (renderStyle.shape === "circle") {
    entity.arc(0, 0, renderStyle.radius * scale, 0, Math.PI * 2, false);
  } else if (renderStyle.shape === "rectangle") {
    entity.drawRect(0, 0, renderStyle.width * scale, renderStyle.height * scale);
  }
  entity.endFill();
  if (Game.thisPlayer !== id && health) {
    var healthBar = renderStyle.shape === "circle" ? game.add.graphics(-renderStyle.radius, (renderStyle.radius + 20) * scale) :
      game.add.graphics(0, (renderStyle.height + 20) * scale);
    healthBar.anchor.set(0, 0);
    entity.addChild(healthBar);
    entity.setChildIndex(healthBar, 0);
    Game.updateHealth(id, health, maxHealth);
  }
  if (Game.thisPlayer !== id && name) {
    var style = { font: "25px Ubuntu", fontWeight: "bold", stroke: "#282828", strokeThickness: 4 * scale, fill: "white", align: "center" };
    var text = game.add.text(0, -40 * scale, name, style);
    text.anchor.set(.5, 1);
    entity.addChild(text);
    entity.setChildIndex(text, 1);
  }
}

/*
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
*/

Game.updatePosition = function (id, x, y) {
  if (Game.entityMap && Game.entityMap[id]) {
    var entity = Game.entityMap[id];
    entity.x = x * scale;
    entity.y = y * scale;
  }
}

Game.removeEntity = function (id) {
  if (Game.entityMap && Game.entityMap[id]) {
    Game.entityMap[id].destroy();
    delete Game.entityMap[id];
  }
};

Game.updateHealth = function (id, health, maxHealth) {
  if (Game.entityMap && Game.entityMap[id]) {
    if (id === Game.thisPlayer) {
      GUI.health = health;
      GUI.maxHealth = maxHealth;
      GUI.update();
    } else {
      var entity = Game.entityMap[id];
      var healthBar = entity.getChildAt(0);
      if (healthBar) {
        healthBar.clear();
        healthBar.beginFill(0x990000);
        healthBar.drawRoundedRect(-5 * scale, -5 * scale, (entity.width / scale + 10) * scale, 20 * scale, 10 * scale);
        healthBar.beginFill(0xff0000);
        healthBar.drawRoundedRect(-2.5 * scale, -2.5 * scale, ((entity.width / scale + 5) * health/maxHealth) * scale, 15 * scale, 10 * scale);
        healthBar.endFill();
      }
    }
  }
}

var movementLast;
Game.update = function () {
  var thisMovement = Game.getMovement();
  if (!movementLast || thisMovement !== movementLast) {
    Client.sendMovement(thisMovement);
    movementLast = thisMovement;
  }
}

Game.registerDeath = function (id) {
  if (Game.entityMap && Game.entityMap[id]) {
    if (id === Game.thisPlayer) {
      Client.askNewPlayer(prompt("You died. Please enter a name to respawn as...", "Anonymous"));
    } else {
      // death animation is forthcoming
    }
  }
}

// detect if the user clicks off page, if so stop their movement
$(window).blur(function () {
  Client.sendMovement({x:0, y:0});
})
