//compete.js 
//Alisha Velji; 101220625

//connect to websocket server 
const socket = new WebSocket(window.location.origin.replace(/^http/, "ws"));
socket.onopen = () => {
    console.log("Connected to server, setting game mode...");
    socket.send(JSON.stringify({ type: "set_mode", mode: "competitive" })); // or "competitive"
};

//variables 
let score = 0;
let scores = {};  
let timeLeft = 60;  
let gameEnded = false;

const hitSound = document.getElementById('hit-sound');

//update the players personal score
function updateScore() {
    const scoreboard = document.querySelector("#scoreboard");

    //checking for the scoreboard tag and updating it (it was removed but i wanted to keep the code in)
    if (scoreboard) {
        console.log("Updating personal score:", score);  
        console.log("Score type is:", typeof score); 
        scoreboard.setAttribute("value", `Your Score: ${score}`);
    } else {
        console.log("Error: #scoreboard element not found.");
    }
}

//update all player scores
function updatePlayerScores() {
    let scoreText = "Player Scores:\n";
    
    //go through all players in the server and update their score 
    Object.keys(scores).forEach(playerId => {
        scoreText += `Player ${playerId}: ${scores[playerId]}\n`;
    });

    //make sure the player scores tag exists
    const playerScores = document.querySelector("#player-scores");
    if (playerScores) {
        playerScores.setAttribute("value", scoreText);
    } else {
        console.log("Error: #player-scores element not found.");
    }

    //update personal score as well
    updateScore();  
}


//end game and show winner
function endGame(winnerId) {
    gameEnded = true;
    const winnerMessage = winnerId === socket.id ? "You Win!" : "You Lose!";
    document.querySelector("#winner-message").setAttribute("value", winnerMessage);
    document.querySelector("#winner-message").setAttribute("visible", "true");
}
socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("received from server:", data);

    if (data.type === "spawn_enemy") {
        spawnEnemy(data.enemyId, data.position);
    } else if (data.type === "enemy_hit") {
        removeEnemy(data.enemyId);

        //make sure the scores are properly updated
        if (!scores[data.playerId]) {
            scores[data.playerId] = 0;
        }
        scores[data.playerId] = data.score;

        //check if players score is updated
        console.log("Updated score for player", data.playerId, ":", scores[data.playerId]);

        //update the local players score if it's their own
        if (data.playerId === socket.id) {
            score = data.score;  //local player score
            console.log("Updating local player score:", score);
            updateScore();  //update the local scoreboard
        }

        updatePlayerScores();  //update the player scoreboard
    } else if (data.type === "update_timer") {
        document.querySelector("#timer").setAttribute("value", `Time: ${data.timeLeft}s`);
    } else if (data.type === "game_over") {
        console.log("Game Over Scores:", data.scores); 

        //store the scores in localStorage so app.js can acceess them 
        localStorage.setItem("playerScores", JSON.stringify(data.scores));
        localStorage.setItem("gameOutcome", data.gameOutcome);

        //go to the game over page after 
        window.location.href = "gameover.html";
    }
};


//spawn a ghost 
function spawnEnemy(id, position) {
    console.log(`Creating enemy: ${id} at`, position);

    const scene = document.querySelector("a-scene");
    const enemy = document.createElement("a-entity");

    //resizing the model 
    enemy.setAttribute("id", `enemy-${id}`);
    enemy.setAttribute("gltf-model", "#enemyModel"); 
    enemy.setAttribute("scale", "0.5 0.5 0.5"); 
    enemy.setAttribute("class", "raycastable");

    setTimeout(() => {
        enemy.setAttribute("position", `${position.x} ${position.y} ${position.z}`);
    }, 10);

    enemy.addEventListener("click", () => {
        socket.send(JSON.stringify({ type: "enemy_hit", enemyId: id, playerId: socket.id }));
        hitSound.play();
    });

    scene.appendChild(enemy);
}


//mobile interactions (touch to shoot ghost)
document.addEventListener("touchstart", (event) => {
    const enemy = event.target.closest(".raycastable");
    if (enemy) {
        hitEnemy(enemy.id);
    }
});

//mobile interactions (touch to shoot ghost)
function removeEnemy(id) {
    const enemy = document.getElementById(`enemy-${id}`);
    if (enemy) enemy.remove();
}
