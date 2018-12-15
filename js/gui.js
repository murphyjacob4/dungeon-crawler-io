var GUI = {};

GUI.user = null;
GUI.experience = 0;
GUI.level = 0;
GUI.health = 0;
GUI.maxHealth = 0;
GUI.scale = 1;
GUI.canvas = document.getElementById("gui");
GUI.context = GUI.canvas.getContext("2d");

GUI.canvas.width = window.innerWidth;
GUI.canvas.height = window.innerHeight;

GUI.update = function () {
    GUI.context.clearRect(0, 0, GUI.canvas.width, GUI.canvas.height);
    // draw name
    GUI.context.font = (scale * 50 ) + "px Ubuntu";
    GUI.context.textAlign = "center";
    GUI.context.fillStyle = "white";
    GUI.context.strokeStyle = "black";
    GUI.context.lineWidth = 4;
    GUI.context.strokeText(GUI.user, GUI.canvas.width / 2, GUI.canvas.height - 65 * scale);
    GUI.context.fillText(GUI.user, GUI.canvas.width / 2, GUI.canvas.height - 65 * scale);
    // draw map
    GUI.context.fillRect(GUI.canvas.width - GUI.canvas.height * 1/4, GUI.canvas.height * 1 / 32, GUI.canvas.height * 7 / 32, GUI.canvas.height * 7 / 32);
    // draw health
    GUI.context.fillStyle = "#990000";
    GUI.context.strokeStyle = "#990000";
    roundRect(GUI.context, GUI.canvas.width /3, GUI.canvas.height - 50 * scale, GUI.canvas.width / 3, 20 * scale, 10 * scale, true, true);
    GUI.context.fillStyle = "#ff0000";
    roundRect(GUI.context, GUI.canvas.width /3, GUI.canvas.height - 50 * scale, GUI.canvas.width / 3 * GUI.health / GUI.maxHealth, 20 * scale, 10 * scale, true, true);
};

window.addEventListener("resize", function () {
    GUI.canvas.width = window.innerWidth;
    GUI.canvas.height = window.innerHeight;
    GUI.update();
});

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
  if (typeof stroke == 'undefined') {
    stroke = true;
  }
  if (typeof radius === 'undefined') {
    radius = 5;
  }
  if (typeof radius === 'number') {
    radius = {tl: radius, tr: radius, br: radius, bl: radius};
  } else {
    var defaultRadius = {tl: 0, tr: 0, br: 0, bl: 0};
    for (var side in defaultRadius) {
      radius[side] = radius[side] || defaultRadius[side];
    }
  }
  ctx.beginPath();
  ctx.moveTo(x + radius.tl, y);
  ctx.lineTo(x + width - radius.tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
  ctx.lineTo(x + width, y + height - radius.br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
  ctx.lineTo(x + radius.bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
  ctx.lineTo(x, y + radius.tl);
  ctx.quadraticCurveTo(x, y, x + radius.tl, y);
  ctx.closePath();
  if (fill) {
    ctx.fill();
  }
  if (stroke) {
    ctx.stroke();
  }

}
