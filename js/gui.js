var GUI = {};

GUI.user = null;
GUI.experience = 0;
GUI.level = 0;
GUI.health = 0;
GUI.maxHealth = 0;
GUI.canvas = document.getElementById("gui");
GUI.context = GUI.canvas.getContext("2d");

GUI.canvas.width = window.innerWidth;
GUI.canvas.height = window.innerHeight;

GUI.update = function () {
    GUI.context.clearRect(0, 0, GUI.canvas.width, GUI.canvas.height);
    GUI.context.font = "50px Ubuntu";
    GUI.context.textAlign = "center";
    GUI.context.fillStyle = "white";
    GUI.context.strokeStyle = "black";
    GUI.context.lineWidth = 4;
    GUI.context.strokeText(GUI.user, GUI.canvas.width / 2, GUI.canvas.height - 60);
    GUI.context.fillText(GUI.user, GUI.canvas.width / 2, GUI.canvas.height - 60);
    GUI.context.fillRect(GUI.canvas.width - GUI.canvas.height * 1/4, GUI.canvas.height * 3 / 4, GUI.canvas.height * 7 / 32, GUI.canvas.height * 7 / 32);
};

window.addEventListener("resize", function () {
    GUI.canvas.width = window.innerWidth;
    GUI.canvas.height = window.innerHeight;
    GUI.update();
});
