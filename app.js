//app.js file
//Alisha Velji; 101220625

const express = require('express');
const WebSocket = require('ws');
const http = require('http');

const app = express();

const server = http.createServer(app);
app.use(express.static('public'));
const wss = new WebSocket.Server({ server });

//variables 
let enemies = {};
let playerScores = {};
let gameRunning = false;
let totalEnemiesHit = 0;
let timeLeft = 70;
const requiredHits = 30;

//default game mode 
let gameMode = "collaborative";

//function to send a message to all connected clients
function broadcast(message) {
    wss.clients.forEach(client => {
        //ensure the client is open before sending the message
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

//function to start spawning ghots at set intervals
function startEnemySpawning() {
    console.log("enemy spawning started...");
    
    //reset game variables
    enemies = {};
    totalEnemiesHit = 0;
    timeLeft = 70;
    gameRunning = true;

    //spawn ghosts every 3 seconds
    const enemySpawnInterval = setInterval(() => {
        //stop spawning if the game is no longer running
        if (!gameRunning) {
            console.log("stopping enemy spawn.");
            clearInterval(enemySpawnInterval);
            return;
        }

        //generate a random ghost id
        const enemyId = Math.random().toString(36).substring(7);
        
        //randomize ghost spawn position within a specific range
        const position = { x: Math.random() * 4 - 2, y: Math.random() * 2 + 1, z: -3 };

        //store enemy data
        enemies[enemyId] = position;
        console.log(`spawning enemy: ${enemyId} at`, position);

        //notify all clients about the new enemy
        broadcast({ type: "spawn_enemy", enemyId, position });
    }, 3000);
}

//function to start the game timer
function startGameTimer() {
    console.log("starting game timer...");
    
    //decrease time left every second
    const timer = setInterval(() => {
        //stop the timer if the game is no longer running
        if (!gameRunning) {
            clearInterval(timer);
            return;
        }

        //decrease the remaining time
        timeLeft--;
        console.log(`time left: ${timeLeft}s`);

        //notify all clients of the updated timer
        broadcast({ type: "update_timer", timeLeft });

        //check if time has run out
        if (timeLeft <= 0) {
            console.log("time's up! Ending game...");
            gameRunning = false;
            clearInterval(timer);

            //determine the winner in competitive mode
            let winnerId = null;
            let highestScore = 0;
            let totalScore = 0;
            
            for (let playerId in playerScores) {
                totalScore += playerScores[playerId];
                if (playerScores[playerId] > highestScore) {
                    highestScore = playerScores[playerId];
                    winnerId = playerId;
                }
            }

            let resultMessage = "Game Over!";
            let gameOutcome = "";

            //determine outcome based on game mode
            if (gameMode === "collaborative") {
                if (totalScore >= requiredHits) {
                    gameOutcome = "You beat the game together!";
                } else {
                    gameOutcome = "You didn't beat the game. Better luck next time!";
                }
            } else if (gameMode === "competitive") {
                gameOutcome = `Winner: Player ${winnerId}`;
            }

            console.log("Final Player Scores:", playerScores);

            //prepare final scores with winner/loser labels
            const finalScores = {};
            for (let playerId in playerScores) {
                finalScores[playerId] = {
                    score: playerScores[playerId],
                    result: playerScores[playerId] === highestScore ? "Winner" : "Loser"
                };
            }

            //send final game results to all players
            broadcast({ 
                type: "game_over", 
                scores: finalScores, 
                winner: winnerId,
                gameOutcome: gameOutcome
            });

            console.log(resultMessage, gameOutcome);
        }
    }, 1000);
}

//handle new WebSocket connections
wss.on('connection', (ws) => {
    //assign a unique id to each player
    ws.id = Math.random().toString(36).substring(7);
    playerScores[ws.id] = 0;

    console.log(`Player Connected: ${ws.id}`);

    //handle incoming messages from clients
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        console.log(`received message from ${ws.id}:`, data);

        //handle game mode selection
        if (data.type === "set_mode") {
            gameMode = data.mode;
            console.log(`game mode set to: ${gameMode}`);
            
            //start the game if it is not already running
            if (!gameRunning) {
                console.log("starting game...");
                gameRunning = true;
                startEnemySpawning();
                startGameTimer();
            } else {
                console.log("game is already running");
            }
        }
    
        //handle ghost hit event
        if (data.type === "enemy_hit") {
            if (enemies[data.enemyId]) {
                delete enemies[data.enemyId];

                //increase the player's score
                if (!playerScores[ws.id]) {
                    playerScores[ws.id] = 0;
                }
                playerScores[ws.id]++;

                console.log(`player ${ws.id} now has ${playerScores[ws.id]} points`);

                //notify all clients about the hit enemy and updated score
                broadcast({
                    type: "enemy_hit",
                    enemyId: data.enemyId,
                    playerId: ws.id,
                    score: playerScores[ws.id],
                });
            }
        }
    });
    
    //handle player disconnection
    ws.on('close', () => {
        console.log(`Player Disconnected: ${ws.id}`);
        delete playerScores[ws.id];
    });
});

//start the server on port 8080
server.listen(8080, () => {
    console.log('Server running at http://localhost:8080');
});
