//  https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Drawing_shapes

// todo: robot sizing / modelling. A circle is just not square enough
// todo: robot should not move on map after failed command request
// todo: bug fix - robot can still turn 360. Why?

//const botRadius = 10.58;
const botRadius = 22 / 2;
const TICK_CM = .325;
const TICK_ANGLE = (.325 * 360) / (10.58 * 2 * Math.PI) * 2; //to rotate on spot
const TURN_OVERLAP_START = 260;
//const TURN_OVERLAP_START = 0;
const startPoint = {x: 0, y: 0};
const delay = 0;
const PING_FRONT_OFFSET = 6;
const PING_BACK_OFFSET = 11;
//const PING_RADIUS_MAX = 50;
const PING_RADIUS_MAX = 100;
//const PING_RADIUS_MIN = 3;
const PING_RADIUS_MIN = 3;

let canvas, ctx, conLinesOn, radiusCircle, autoRadarOn;
let check_collisions = false;

// redraw on canvas resizing
let redraw = false;
let animation_ongoing = false;
let animation;
let hideMovementPossibilities = true;

// canvas properties and (0,0) offset
let canvasMaxX = 1000;
let canvasMaxY = 1000;
let startOffsetX = canvasMaxX / 2;
let startOffsetY = canvasMaxY / 2;
let scale = 2;
let gridSize = 20;

// sizing of everything else
const pingLineLen = .05; // in percent of "ping to object" distance
const pointSize = 3;
const markerSize = pointSize * 2;

// all points and things drawn
let obstacleSet = [];
let bot = {point: startPoint, angle: 90};
let movement = [startPoint];
let markers = [];

//stats
let distance_driven = 0;
let angle_turned = 0;
let ticks_driven = 0;
let commandNumber = -1;
let robot_available = false;

// initialize everything here -> main()
window.onload = init;

/**
 * initialize on window.onload:
 * - all event listeners,
 * - the canvas
 * - draw grid / bot / other lines
 */
function init() {

    const conLines = document.getElementById('conLines');
    const radiusParam = document.getElementById("btn3");
    const radarCheckbox = document.getElementById("radar");
    const movePossParam = document.getElementById("movePoss");

    hideMovementPossibilities = !movePossParam.checked;
    conLinesOn = conLines.checked;
    radiusCircle = radiusParam.value;
    autoRadarOn = radarCheckbox.checked;

    window.onblur = function () {
        mode = -1;
    };
    window.onfocus = function () {
        //document.title='FOCUSED' dostuff
    };


    conLines.onchange = function () {
        conLinesOn = conLines.checked;
        draw_plus_robot();
    };

    canvas = document.getElementById('canvas');
    if (canvas.getContext) {
        ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        setScale(2);
    } else {
        alert("unsupported browser!");
    }

    canvas.onmousemove = function (e) {
        const pos = getMousePos(canvas, e);
        document.getElementById("mousePosition").innerHTML = "x:" + pos.x + ", y:" + pos.y + "<br>Roboter: " + (robot_available ? "" : "nicht") + " verfügbar";
    };
    canvas.onmouseleave = function () {
        document.getElementById("mousePosition").innerHTML = "---" + "<br>Roboter: " + (robot_available ? "" : "nicht") + " verfügbar";
    };
    canvas.onclick = function (e) {
        const point = getMousePos(canvas, e);
        switch (mode) {
            case 1:
                addObstacle(point);
                break;
            case 2:
                moveRobot(point);
                break;
            case 4:
                addMarker(point);
                break;
        }


        if (mode !== 2) {
            draw_plus_robot();
        } else {
            draw();
        }
    };

    setInterval(function () {
        if (sendstatus)
            get_status();
    }, 5000);

    updateStats();
    updateScale();
    updateGrid();
    drawBot(bot.point);
    
    clearQueue();
    setTimeout(function(){
        get_status();
    },1000);
    
}

/**
 * reset everything to start again
 */
function reset() {
    obstacleSet = [[]];
    bot = {point: startPoint, angle: 90};
    movement = [startPoint];
    markers = [];
    distance_driven = 0;
    angle_turned = 0;
    ticks_driven = 0;
    document.getElementById("log").innerHTML = '';
    updateStats();
    draw_plus_robot();
}

/**
 * load from cookie (modern browsers)
 */
function load() {
    const storage = localStorage.getItem("mydata");
    const o = JSON.parse(storage);
    if (!o)
        return;

    reset();

    console.log("loading:", storage);

    obstacleSet = o.obs;
    bot = o.bot;
    movement = o.mov;
    markers = o.mar;
    distance_driven = o.dis;
    angle_turned = o.ang;
    ticks_driven = o.tic;
    document.getElementById("log").innerHTML = o.log;
    updateStats();
    draw_plus_robot();
}

/**
 * save to cookie (modern browsers)
 */
function save() {
    const o = {
        obs: obstacleSet,
        bot: bot,
        mov: movement,
        mar: markers,
        dis: distance_driven,
        ang: angle_turned,
        tic: ticks_driven,
        log: document.getElementById("log").innerHTML
    };
    localStorage.setItem("mydata", JSON.stringify(o));
}

/**
 * resize canvas to this size
 * @param width {number}
 * @param height {number}
 */
function setCanvasSize(width, height) {
    canvasMaxY = height;
    canvasMaxX = width;
    canvas.width = width;
    canvas.height = height;
}

/**
 * add single pinged obstacle to list
 * @param point {{x: number, y: number}}
 */
function addObstacle(point) {
    let ind = obstacleSet.length - 1;

    if (ind < 0) {
        createNewObstacleSet();
        ind++;
    }
    let vec = vector(bot.point, point);
    vec = multiplyScalar(vec, -pingLineLen);
    vec = addVectors(vec, point);

    obstacleSet[ind].push({x: point.x, y: point.y, ax: vec.x, ay: vec.y});
    save();
}

/**
 * add waypoint/marker to list
 * @param point {{x: number, y: number}}
 */
function addMarker(point) {
    markers.push(point);
    save();
}

/**
 * clear all markers from the map
 */
function clearMarkers() {
    markers = [];
    draw_plus_robot();
}

/**
 * change the zoom/scale of the map
 * @param toscale {number}
 */
function setScale(toscale) {
    scale = toscale;
    draw_plus_robot();

}

/**
 * change the width of the grid
 * @param togridsize {number}
 */
function setGridSize(togridsize) {
    gridSize = togridsize;
    draw_plus_robot();
}

/**
 * get vector between two points
 * @param pointFrom {{x: number, y: number}}
 * @param pointTo {{x: number, y: number}}
 * @returns {{x: number, y: number}}
 */
function vector(pointFrom, pointTo) {
    return addVectors(pointTo, multiplyScalar(pointFrom, -1));
}

/**
 * get vector from length and angle relative to x axis
 * @param length {number}
 * @param degreefromx {number}
 * @returns {{x: number, y: number}}
 */
function vector2(length, degreefromx) {
    return {
        x: length * Math.cos(rad(degreefromx)),
        y: length * Math.sin(rad(degreefromx))
    }
}

/**
 * get length of vector
 * @param vector {{x: number, y: number}}
 * @returns {number} length
 */
function vectorLen(vector) {
    // noinspection JSSuspiciousNameCombination
    return Math.sqrt(Math.pow(vector.x, 2) + Math.pow(vector.y, 2));
}

/**
 * round vector values x,y to zero decimals
 * @param vector {{x: number, y: number}}
 * @returns {{x: number, y: number}}
 */
function vectorRound(vector) {
    // noinspection JSSuspiciousNameCombination
    return {x: Math.round(vector.x), y: Math.round(vector.y)}
}

/**
 * Scalar multiply two vectors
 * @param vector1 {{x: number, y: number}}
 * @param vector2 {{x: number, y: number}}
 * @returns {number}
 */
function vectorScalarMultiply(vector1, vector2) {
    return vector1.x * vector2.x + vector1.y * vector2.y;
}

/**
 * Angle between two vectors (absolute)
 * @param vector1 {{x: number, y: number}}
 * @param vector2 {{x: number, y: number}}
 * @returns {number}
 */
function vectorAngleBetween(vector1, vector2) {
    return deg(Math.acos(vectorScalarMultiply(vector1, vector2) / (vectorLen(vector1) * vectorLen(vector2))));
}

/**
 * multiply vector with scalar
 * @param vector {{x: number, y: number}}
 * @param scalar {number}
 * @returns {{x: number, y: number}}
 */
function multiplyScalar(vector, scalar) {
    return {x: vector.x * scalar, y: vector.y * scalar};
}

/**
 * add two vectors
 * @param vectorA {{x: number, y: number}}
 * @param vectorB {{x: number, y: number}}
 * @returns {{x: number, y: number}}
 */
function addVectors(vectorA, vectorB) {
    return {x: vectorA.x + vectorB.x, y: vectorA.y + vectorB.y};
}

/**
 * creates new set of obstacles (one each per PING sweep)
 */
function createNewObstacleSet() {
    obstacleSet.push([]);
}

/**
 * draw all obstacles on map
 */
function drawObstacles() {
    ctx.fillStyle = "black";
    ctx.strokeStyle = "black";
    for (let i = 0; i < obstacleSet.length; i++) {
        if (i === obstacleSet.length - 1) {
            ctx.fillStyle = "red";
            ctx.strokeStyle = "red";
        }
        const obstacles = obstacleSet[i];
        for (let j = 0; j < obstacles.length; j++) {
            drawPoint(obstacles[j]);
            drawLine({x: obstacles[j].ax, y: obstacles[j].ay}, obstacles[j]);
        }

    }
}

/**
 * delete all obstacles within a certain radius around a point
 * @param center {{x: number, y: number}}
 * @param radius {number}
 */
function deleteObstacles(center, radius) {
    for (let i = 0; i < obstacleSet.length; i++) {
        const obstacles = obstacleSet[i];
        for (let j = 0; j < obstacles.length; j++) {
            if (vectorLen(vector(center, obstacles[j])) < radius) {
                obstacleSet[i].splice(j--, 1);
            }
        }
    }
    draw_plus_robot();
}

/**
 * draw all markers in list on the map
 */
function drawMarkers() {
    ctx.fillStyle = "red";
    for (let i = 0; i < markers.length; i++) {
        drawPoint(markers[i], markerSize);
    }

}

/**
 * convert degrees to radians
 * @param deg {number}
 * @returns {number}
 */
function rad(deg) {
    return deg / 180 * Math.PI;
}

/**
 * convert radians to degrees
 * @param rad {number}
 * @returns {number}
 */
function deg(rad) {
    return rad / Math.PI * 180;
}

/**
 * make degrees positive and mod 360
 * @param degree {number}
 * @returns {number}
 */
function normalize(degree) {
    return (degree + 360) % 360;
}

/**
 * move robot to point. Moves robot only to reachable angles (no half ticks possible!)
 * @param point {{x: number, y: number}}
 */
function moveRobot(point) {

    if (animation_ongoing) {
        setTimeout(function () {
            moveRobot(point)
        }, 333);
        return;
        //bot.point = point;
    }
    //console.log("driving... brumm...");
    if (bot.point === point)
        return;
    const target = vector(bot.point, point);
    let alpha = deg(Math.atan(target.y / target.x));
    const beta = bot.angle;
    if (target.x < 0) alpha -= 180;

    // blue
    const gamma = -Math.round(normalize(beta - alpha) / TICK_ANGLE) * TICK_ANGLE + beta;
    let length = vectorLen(target);

    length = Math.round(length / TICK_CM) * TICK_CM;
    const solution = vector2(length, gamma);
    //target = {x: length * Math.cos(corrAngle / 180 * Math.PI), y: length * Math.sin(corrAngle / 180 * Math.PI)};

    // red
    const gamma2 = (Math.round((normalize(beta - alpha) - 360) / -TICK_ANGLE) * TICK_ANGLE + beta);
    const solution2 = vector2(length, gamma2);
    //solution2.x *= -1;

    // pink
    const gamma3 = -Math.round(normalize(beta - alpha + 180) / TICK_ANGLE) * TICK_ANGLE + beta + 180;
    const solution3 = vector2(length, gamma3);

    //green
    const gamma4 = Math.round((normalize(beta - alpha + 180) - 360) / -TICK_ANGLE) * TICK_ANGLE + beta + 180;
    const solution4 = vector2(length, gamma4);


    const len1 = vectorLen(vector(target, solution));
    const len2 = vectorLen(vector(target, solution2));
    const len3 = vectorLen(vector(target, solution3));
    const len4 = vectorLen(vector(target, solution4));

    const deg1 = normalize(beta - gamma);
    const deg2 = normalize(beta - gamma2);
    const deg3 = normalize(beta - gamma3);
    const deg4 = normalize(beta - gamma4);

    let part = 1;
    let lenMin = 1 / 0;
    let sol = solution;
    let gamm = gamma;

    if (deg1 <= 360 - TURN_OVERLAP_START) {
        lenMin = len1;
    }
    if (deg2 > TURN_OVERLAP_START && len2 < lenMin) {
        lenMin = len2;
        sol = solution2;
        gamm = gamma2;

        part = 2;
    }
    if (normalize(deg4 - 180) < 360 - TURN_OVERLAP_START && len3 < lenMin) {
        lenMin = len3;
        sol = solution3;
        gamm = gamma3 + 180;
        part = 3;
    }
    if (normalize(deg3 - 180) > TURN_OVERLAP_START && len4 < lenMin) {
        sol = solution4;
        gamm = gamma4 + 180;
        part = 4;
    }

    point = addVectors(bot.point, sol);
    gamm = normalize(gamm);

    if (isCollidingWithObstacle(bot.point, point, length, gamm, botRadius)) {
        log("COLLISION! couldn't drive towards " + JSON.stringify(point));
        return;
    }

    let degx;
    let rlen = Math.round(length * 10) / 10;
    switch (part) {
        case 1:
            degx = deg1;
            log("blue: turning forward right " + rlen + "cm at angle " + Math.round(degx * 10) / 10 + "° to " + JSON.stringify(point));
            drive_command(point, degx, length);
            angle_turned += degx;
            break;
        case 2:
            degx = deg2 - 360;
            log("red: turning forward left " + rlen + "cm at angle " + Math.round(-degx * 10) / 10 + "° to " + JSON.stringify(point));
            drive_command(point, degx, length);
            angle_turned -= degx;
            break;
        case 3:
            degx = normalize(deg3 - 180);
            log("pink: turning backwards right " + rlen + "cm at angle " + Math.round(degx * 10) / 10 + "° to " + JSON.stringify(point));
            drive_command(point, degx, -length);
            angle_turned += degx;
            break;
        case 4:
            degx = normalize(deg4 - 180) - 360;
            log("green: turning backwards left " + rlen + "cm at angle " + Math.round(-degx * 10) / 10 + "° to " + JSON.stringify(point));
            drive_command(point, degx, -length);
            angle_turned -= degx;
            break;
    }


    movement.push(point);
    bot.point = point;
    bot.angle = gamm;

    distance_driven += length;
    updateStats();

    if (autoRadarOn)
        get_radar_points();


    //robotAnimation(64 * TICK_CM * 10);
    robotAnimation(150 / 8);


    //draw();
}

/**
 * turn robot on the spot, angle normalizes to TICK_ANGLE
 * @param degrees {number}
 */
function moveRobotTurn(degrees) {
    degrees = Math.round(degrees / TICK_ANGLE) * TICK_ANGLE;
    bot.angle = normalize(bot.angle + degrees);
    draw_plus_robot();
    drive_command(bot.point, -degrees, 0);
}

/**
 * rotate a point around the origin (x=0,y=0)
 * to rotate around other points translate before and after
 * @param point {{x: number, y: number}}
 * @param angle {number}
 * @returns {{x: number, y: number}}
 */
function rotate_around_origin(point, angle) {
    return {
        x: point.x * Math.cos(rad(angle)) - point.y * Math.sin(rad(angle)),
        y: point.y * Math.cos(rad(angle)) + point.x * Math.sin(rad(angle))
    }
}

/**
 * rotate robot and the last obstacle set around itself
 * @param angle {number}
 */
function robot_rotate(angle) {
    const i = obstacleSet.length - 1;
    bot.angle += angle;
    if (i >= 0)
        for (let j = 0; j < obstacleSet[i].length; j++) {
            let point = obstacleSet[i][j];
            let apoint = {x: obstacleSet[i][j].ax, y: obstacleSet[i][j].ay};

            point = vector(bot.point, point);
            apoint = vector(bot.point, apoint);

            point = rotate_around_origin(point, angle);
            apoint = rotate_around_origin(apoint, angle);

            point = addVectors(point, bot.point);
            apoint = addVectors(apoint, bot.point);

            obstacleSet[i][j] = {x: point.x, y: point.y, ax: apoint.x, ay: apoint.y};
        }

    draw_plus_robot();

}

/**
 * translate robot and last obstacle set along a vector
 * @param vec {{x: number, y: number}}
 */
function robot_translate(vec) {
    const i = obstacleSet.length - 1;
    bot.point = addVectors(bot.point, vec);
    movement[movement.length - 1] = bot.point;
    if (i >= 0)
        for (let j = 0; j < obstacleSet[i].length; j++) {
            obstacleSet[i][j] = addVectors(obstacleSet[i][j], vec);
        }
    draw_plus_robot();
}

// noinspection JSUnusedGlobalSymbols
/**
 * rotate everything else than in robot_rotate()
 * @param angle {number}
 */
function graph_rotate(angle) {
    for (let i = 0; i < obstacleSet.length - 1; i++) {
        for (let j = 0; j < obstacleSet[i].length; j++) {
            const xy = rotate_around_origin(obstacleSet[i][j], angle);
            const axy = rotate_around_origin({x: obstacleSet[i][j].ax, y: obstacleSet[i][j].ay}, angle);
            obstacleSet[i][j] = {x: xy.x, y: xy.y, ax: axy.x, ay: axy.y};
        }
    }
    draw_plus_robot();
}

// noinspection JSUnusedGlobalSymbols
/**
 * translate everything else than in robot_translate()
 * @param vec {{x: number, y: number}}
 */
function graph_translate(vec) {
    for (let i = 0; i < obstacleSet.length - 1; i++) {
        for (let j = 0; j < obstacleSet[i].length; j++) {
            obstacleSet[i][j] = addVectors(obstacleSet[i][j], vec);
        }
    }
    draw_plus_robot();
}

/**
 * rudimentary robot animation
 * @param cm_per_sec {number}
 */
function robotAnimation(cm_per_sec) {

    //ctx.save();
    if (movement.length < 2 || animation_ongoing) {
        draw();
        return;
    }
    animation_ongoing = true;
    //var org_target = bot.point;
    const intervalLength = .01; // seconds
    const origin = movement[movement.length - 2];
    const vec = vector(origin, bot.point);
    const distance = vectorLen(vec);
    let fraction = 0;
    drawBot(origin);
    animation = setInterval(function () {
        fraction += cm_per_sec * intervalLength;
        //console.log(fraction, distance);
        const inBetween = multiplyScalar(vec, fraction / distance);
        ctx.clearRect(0, 0, canvasMaxX, canvasMaxY);
        //ctx.restore();
        draw();
        drawBot(addVectors(origin, inBetween)); //todo dont save this here (wrong angle)

        if (fraction >= distance || animation_ongoing === false) {
            clearInterval(animation);
            // ctx.clearRect(0, 0, canvasMaxX, canvasMaxY);
            //bot.point = org_target;
            draw();
            drawBot(bot.point);
            animation_ongoing = false;
            save();
            //draw();
        }
    }, intervalLength * 1000);
    //console.log(animation_ongoing);
}

/**
 * checks if there are obstacles within a radius on a vector
 * @param fromPoint {{x: number, y: number}}
 * @param toPoint {{x: number, y: number}}
 * @param length {number}
 * @param atAngle {number}
 * @param radius {number}
 * @returns {boolean}
 */
function isCollidingWithObstacle(fromPoint, toPoint, length, atAngle, radius) {
    if (!check_collisions) {
        return false;
    }
    for (let i = 0; i < obstacleSet.length; i++) {
        const obstacles = obstacleSet[i];
        for (let j = 0; j < obstacles.length; j++) {

            const ac = vector(fromPoint, obstacles[j]);
            const b = vectorLen(ac);
            //const alpha = deg(Math.atan(ac.y / ac.x));

            //var gamma = normalize(alpha - atAngle);
            const gamma = vectorAngleBetween(ac, vector(fromPoint, toPoint));

            //drawLine(fromPoint, toPoint);
            //drawLine(fromPoint, obstacles[j]);

            if (Math.abs(b * Math.sin(rad(gamma))) < radius && b * Math.cos(rad(gamma)) < length + radius && gamma < 90) {
                addMarker(obstacles[j]);
                setTimeout(function () {
                    markers.splice(markers.length - 1, 1);
                    draw_plus_robot();
                }, 500);
                draw_plus_robot();
                return true;
            }
        }
    }
    return false;

}

/**
 * move robot back to starting position and delete path
 */
function driveBackToStart() {
    let j = 1;
    for (let i = movement.length - 2; i > 0; i--, j++) {
        setTimeout(function () {
            moveRobot(movement[i]);
        }, 500 * j);
    }
    setTimeout(function () {
        moveRobot(startPoint);
        //movement.splice(0, movement.length - 2);
        //draw();
    }, 500 * j);

}

/**
 * clears the log below the canvas
 */
function log_clear() {
    document.getElementById("log").innerHTML = '';
}

/**
 * log to screen and console
 * @param str string
 */
function log(str) {
    const text = document.getElementById("log").innerHTML;
    const count = (text.match(/div/g) || []).length;

    function timeNow() {
        var d = new Date(),
            h = (d.getHours() < 10 ? '0' : '') + d.getHours(),
            m = (d.getMinutes() < 10 ? '0' : '') + d.getMinutes(),
            s = (d.getSeconds() < 10 ? '0' : '') + d.getSeconds();
        return h + ':' + m + ':' + s;
    }

    if (count > 30)
        log_clear();
    console.log(str);
    document.getElementById("log").innerHTML += '<div>' + timeNow() + " - " + str + '</div>'
}

/**
 * log to screen and console and print a spacer afterwards
 * @param str string
 */
function logAbsatz(str) {
    log(str);
    document.getElementById("log").innerHTML += '<div>---</div>'
}

/**
 * connect a set of points on the map with a line
 * @param points {Object[]} array of points
 * @param color string
 * @param skipPoints boolean if to skip points if more than bot diameter apart
 */
function drawConnectLines(points, color, skipPoints) {
    if (points.length < 1) return;
    ctx.strokeStyle = color;
    ctx.beginPath();
    let pos = getPos(points[0]);
    ctx.moveTo(pos.x, pos.y);
    for (let i = 1; i < points.length; i++) {
        pos = getPos(points[i]);

        if (skipPoints && vectorLen(vector(points[i - 1], points[i])) > 2 * botRadius) {
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
        } else {
            ctx.lineTo(pos.x, pos.y);
        }
    }
    ctx.stroke();
}

/**
 * draw a circle
 * @param center {{x: number, y: number}}
 * @param radius {number}
 */
function drawCircle(center, radius) {
    //console.log(center, radius);
    const pos = getPos(center);
    ctx.strokeStyle = "black";
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius * scale, 0, Math.PI * 2, true); // circle (200,200 as center)
    ctx.stroke();
}

/**
 * draw possible movement angles reachable with ticks
 */
function drawMovementPossibilities() {
    if (hideMovementPossibilities)
        return;
    const range = 360 - TURN_OVERLAP_START;
    ctx.strokeStyle = 'red';
    const point = bot.point;
    for (let i = bot.angle; i < bot.angle + range; i += TICK_ANGLE) {
        drawLine(point, addVectors(point, {x: radiusCircle * Math.cos(rad(i)), y: radiusCircle * Math.sin(rad(i))}))
    }
    ctx.strokeStyle = 'blue';
    for (let i = bot.angle; i > bot.angle - range; i -= TICK_ANGLE) {
        drawLine(point, addVectors(point, {x: radiusCircle * Math.cos(rad(i)), y: radiusCircle * Math.sin(rad(i))}))
    }

    ctx.strokeStyle = '#37ff18';
    for (let i = bot.angle + 180; i < bot.angle + range + 180; i += TICK_ANGLE) {
        drawLine(point, addVectors(point, {x: radiusCircle * Math.cos(rad(i)), y: radiusCircle * Math.sin(rad(i))}))
    }

    ctx.strokeStyle = '#ff00fc';
    for (let i = bot.angle + 180; i > bot.angle - range + 180; i -= TICK_ANGLE) {
        drawLine(point, addVectors(point, {x: radiusCircle * Math.cos(rad(i)), y: radiusCircle * Math.sin(rad(i))}))
    }
}

/**
 * draw the robot on its position
 */
function drawBot(point) {
    const angleDeg = bot.angle;
    const angleRad = rad(angleDeg);
    const pos = getPos(point);

    drawMovementPossibilities();
    // bot circle fill
    ctx.fillStyle = 'green';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, botRadius * scale, 0, Math.PI * 2, true); // circle (200,200 as center)
    ctx.fill();

    // angle from center
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    drawLine(point,
        {
            x: point.x + (botRadius * 3) * Math.cos(angleRad),
            y: point.y + (botRadius * 3) * Math.sin(angleRad)
        }
    );
    ctx.lineWidth = 1;

    drawCircle(point, radiusCircle);
}

/**
 * draw the grid
 * @param size {number}
 * @param width {number}
 */
function drawGrid(size, width) {
    const oldwidth = ctx.lineWidth;
    if (typeof width != "undefined")
        ctx.lineWidth = width;

    ctx.strokeStyle = "lightgrey";
    const topleft = vectorRound(getPoint({x: 15, y: 15}));
    const bottomRight = vectorRound(getPoint({x: canvasMaxX - 15, y: canvasMaxY - 15}));
    //console.log(topleft, bottomRight);
    for (let i = topleft.x; i <= bottomRight.x; i++) {
        if (i === 0)
            ctx.strokeStyle = "grey";
        if (i % size === 0)
            drawLine({x: i, y: topleft.y}, {x: i, y: bottomRight.y});
        if (i === 0)
            ctx.strokeStyle = "lightgrey";
    }
    for (let i = bottomRight.y; i <= topleft.y; i++) {
        if (i === 0)
            ctx.strokeStyle = "grey";
        if (i % size === 0)
            drawLine({x: topleft.x, y: i}, {x: bottomRight.x, y: i});
        if (i === 0)
            ctx.strokeStyle = "lightgrey";
    }
    ctx.strokeStyle = "grey";


    ctx.lineWidth = oldwidth;
}

/**
 * converts points to canvas positions and enlarges the canvas if necessary
 * @param point {{x: number, y: number}}
 * @returns {{x: number, y: number}}
 */
function getPos(point) {
    let on = true;
    let pos = null;
    let i = 0;
    for (; on && i < 100; i++) {
        //if (i > 0) console.log(point, i);
        pos = {x: startOffsetX + point.x * scale, y: startOffsetY - point.y * scale};
        on = false;
        if (pos.x > canvasMaxX - 10) {
            canvasMaxX = pos.x + 11;
            setCanvasSize(canvasMaxX, canvasMaxY);
            i++;
        }
        if (pos.y > canvasMaxY - 10) {
            canvasMaxY = pos.y + 11;
            setCanvasSize(canvasMaxX, canvasMaxY);
            i++;
        }
        if (pos.x < 10) {
            startOffsetX = startOffsetX - pos.x + 11;
            canvasMaxX -= pos.x - 11;
            setCanvasSize(canvasMaxX, canvasMaxY);
            on = true;
        }
        if (pos.y < 10) {
            startOffsetY = startOffsetY - pos.y + 11;
            canvasMaxY -= pos.y - 11;
            setCanvasSize(canvasMaxX, canvasMaxY);
            on = true;
        }

    }
    if (i > 1) redraw = true;
    return pos;
}

/**
 * converts canvas position to point on map
 * @param pos {{x: number, y: number}}
 * @returns {{x: number, y: number}}
 */
function getPoint(pos) {
    return {x: (pos.x - startOffsetX) / scale, y: (startOffsetY - pos.y) / scale}
}

/**
 * plot a point on the map
 * @param point {{x: number, y: number}}
 * @param size {number}
 */
function drawPoint(point, size) {
    const pos = getPos(point);
    if (typeof size == 'undefined')
        size = pointSize;
    //console.log(pos);
    ctx.fillRect(pos.x - size * scale / 2, pos.y - size * scale / 2, size * scale, size * scale);
}

/**
 * draw a line between two points
 * @param pointA {{x: number, y: number}}
 * @param pointB {{x: number, y: number}}
 */
function drawLine(pointA, pointB) {

    // console.log(pointB);
    const posA = getPos(pointA);
    const posB = getPos(pointB);

    ctx.beginPath();
    ctx.moveTo(posA.x, posA.y);
    ctx.lineTo(posB.x, posB.y);
    ctx.stroke();
}

/**
 * draw everything except the robot (->animation) on the canvas (calls all other draw functions)
 */
function draw() {

    ctx.clearRect(0, 0, canvasMaxX, canvasMaxY);

    fitCanvasSize();

    drawGrid(gridSize, 1);
    drawConnectLines(movement, "green", false);
    if (conLinesOn)
        for (let i = 0; i < obstacleSet.length; i++) {
            drawConnectLines(obstacleSet[i], "orange", true);
        }

    drawObstacles();
    //drawBot(bot.point);
    drawMarkers();


    if (redraw) {
        redraw = false;
        draw();

    }

}

/**
 * do draw() and draw the robot
 */
function draw_plus_robot() {
    draw();
    drawBot(bot.point);
}

/**
 * fit canvas to range of points
 */
function fitCanvasSize() {

    const mm = minmaxAll();
    const topleft = {x: mm.xmin, y: mm.ymax};
    const bottomright = {x: mm.xmax, y: mm.ymin};

    const topleftCanvas = getPoint({x: 0, y: 0});
    const sollX = vector(topleft, topleftCanvas);

    if (sollX.x < 0) {
        startOffsetX += sollX.x * scale + 15;
    }
    if (sollX.y > 0) {
        startOffsetY -= sollX.y * scale - 15;
    }

    const bottomRightCanvas = getPoint({x: canvasMaxX, y: canvasMaxY});
    const sollY = vector(bottomright, bottomRightCanvas);

    if (sollY.x > 0)
        setCanvasSize(canvasMaxX - sollY.x * scale + 15, canvasMaxY);
    if (sollY.y < 0)
        setCanvasSize(canvasMaxX, canvasMaxY + sollY.y * scale + 15);
    //console.log("before", topleftCanvas, bottomRightCanvas);
    //console.log("soll", getPoint({x: 0, y: 0}), getPoint({x: canvasMaxX, y: canvasMaxY}), sollX, sollY);

    getPos(topleft);
    getPos(bottomright);
}

/**
 * find minimum and maximum of ALL points drawn
 * @returns {{ymin: number, xmin: number, ymax: number, xmax: number}}
 */
function minmaxAll() {
    const all = obstacleSet;
    const circle = [

        addVectors(bot.point, {x: -radiusCircle, y: 0}),
        addVectors(bot.point, {y: -radiusCircle, x: 0}),
        addVectors(bot.point, {x: +radiusCircle, y: 0}),
        addVectors(bot.point, {y: +radiusCircle, x: 0})
    ];
    all.push(movement);
    all.push(markers);
    all.push(circle);

    const ount = minmax(all);
    //console.log(ount);
    obstacleSet.splice(obstacleSet.length - 3, 3);

    return ount;
}

/**
 * find xmax and ymax in a list of points
 * @param pointarray {Object[]} array of points
 * @returns {{x: number, y: number}}
 */
function amax(pointarray) {
    const max = {x: -1 / 0, y: -1 / 0};
    for (let i = 0; i < pointarray.length; i++) {
        if (pointarray[i].x > max.x)
            max.x = pointarray[i].x;
        if (pointarray[i].y > max.y)
            max.y = pointarray[i].y;

    }
    return max;
}

/**
 * find xmin and ymin in a list of points
 * @param pointarray {Object[]} array of points
 * @returns {{x: number, y: number}}
 */
function amin(pointarray) {

    const min = {x: 1 / 0, y: 1 / 0};
    for (let i = 0; i < pointarray.length; i++) {
        if (pointarray[i].x < min.x)
            min.x = pointarray[i].x;
        if (pointarray[i].y < min.y)
            min.y = pointarray[i].y;

    }
    return min;
}

/**
 * find minimums and maximums in a list of lists of points
 * @param pointarr2d {Object[][]} 2D array of points
 * @returns {{ymin: number, xmin: number, ymax: number, xmax: number}}
 */
function minmax(pointarr2d) {

    const minmax = {xmin: 1 / 0, xmax: -1 / 0, ymin: 1 / 0, ymax: -1 / 0};
    //console.log(pointarr2d);
    for (let i = 0; i < pointarr2d.length; i++) {
        const max = amax(pointarr2d[i]);
        const min = amin(pointarr2d[i]);

        //console.log(max, min);
        if (minmax.xmin > min.x)
            minmax.xmin = min.x;
        if (minmax.ymin > min.y)
            minmax.ymin = min.y;
        if (minmax.xmax < max.x)
            minmax.xmax = max.x;
        if (minmax.ymax < max.y)
            minmax.ymax = max.y;

    }
    return minmax;
}

/**
 * get mouse coordinates
 * @param {Object} canvas canvas object
 * @param {Object} evt event
 * @returns {{x: number, y: number}} point
 */
function getMousePos(canvas, evt) {
    const rect = canvas.getBoundingClientRect();
    return getPoint({
        x: (evt.clientX - rect.left) / (rect.right - rect.left) * canvas.width,
        y: (evt.clientY - rect.top) / (rect.bottom - rect.top) * canvas.height
    });
}