var laby_on = false;
var sendstatus = true;
const stdtimeout = 20000;

commandNumber = 0;
/*
httpGet("number", function (m) {
    commandNumber = m;
});*/

/**
 * send drive command to Bot
 * @param point {{x,y}}
 * @param relative_angle in degrees. if < 0: turn left this much. if >= 0 turn right this much
 * @param distance to travel in cm
 */
function drive_command(point, relative_angle, distance) {
    const turnTicks = Math.round(relative_angle / TICK_ANGLE);
    const driveTicks = Math.round(distance / TICK_CM);

    ticks_driven += Math.abs(turnTicks) + Math.abs(driveTicks);

    const msg = turnTicks + "," + (-turnTicks) + "," + driveTicks + "," + (commandNumber + 1);
    //log("turning " + turnTicks + " ticks (l:" + turnTicks + " | r:" + (-turnTicks) + "). Driving " + driveTicks + " ticks (l:" + driveTicks + " | r:" + driveTicks + ")");
    logAbsatz("sending: '" + msg + " => drive_goto(" + turnTicks + "," + (-turnTicks) + "); drive_goto(" + driveTicks + "," + driveTicks + ");");

    // left,right,forwards,x,y,angle,cmd#
    POST_request("cmd", msg);
    //POST_request("cmd", turnTicks + "," + (-turnTicks) + "," + driveTicks + "," +
    //    Math.round(point.x) + "," + Math.round(point.y) + "," + Math.round(relative_angle) + "," + commandNumber
    //);

}


/**
 * request status update, prints error to console if not connected
 */
function get_status() {
    //if (!sendstatus)
    //    return;
    GET_request("status", function (ok) {
        robot_available = true;
        document.getElementById("mousePosition").innerHTML = "---" + "<br>Roboter: " + (robot_available ? "" : "nicht") + " verfügbar";
        if (ok.includes("laby")) {
            logAbsatz("Status empfangen: Labymode aktiv!");
            laby_on = true;
            document.getElementById("laby").innerHTML = "LABY-MODE!";
        } else if (laby_on) {
            laby_on = false;
            alert("Laby Mode vorbei...");
            document.getElementById("laby").innerHTML = "driving mode active";
        }
        //console.log("status response: ", ok);
    });
}

/**
 * request to start labyrinth mode
 */
function get_labyrinth() {
    POST_request("cmd", "X");
}

/**
 * request radar sweep data
 */
function get_radar_points() {

    sendstatus = false;
    requestThing("ping", function (ok) {

        console.log("response:", ok, "waiting for ping to finish...");

        document.getElementById("laby").innerHTML = "Pinging...";

        createNewObstacleSet();
        for (let i = 0; i < 4; i++) {
            setTimeout(function(){
                requestThing("pingdata", function (response) {
                //console.log("ping-response nr " + i + ": '" + response + "'");

                    if (i < 2)
                        add_obstacles_from_string(response, i * 90, PING_FRONT_OFFSET);
                    else
                        add_obstacles_from_string(response, i * 90, -PING_BACK_OFFSET);

                    draw_plus_robot();

                    if (i === 3) {
                        sendstatus = true;
                        document.getElementById("laby").innerHTML = "driving mode...";
                    }
                },30000);
            },i*200);
        }


    },stdtimeout);

}

/**
 *
 * @param str {string} input string recieved from robot
 * @param offset {number} offset of degree angle of first value
 * @param offset_cm {number} offset of ping to center of robot in cm
 */
function add_obstacles_from_string(str, offset, offset_cm) {
    const array = str.split("_");
    const off_vector = vector2(offset_cm, bot.angle);
    const delta_angle = 6;
    //console.log(off_vector);

    for (let j = 0; j < array.length; j++) {
        const l = 1 * array[j];
        if(l === 0){
            console.log("WARNING: Ping gab 0 zurück.");
        }
        const alpha = rad(bot.angle + (j * delta_angle) - 90 + offset);
        const rel = {x: l * Math.cos(alpha), y: l * Math.sin(alpha)};

        const absolute = addVectors(off_vector, rel);
        const dist = vectorLen(rel);
        if (dist >= PING_RADIUS_MIN && dist <= PING_RADIUS_MAX)
            addObstacle(addVectors(bot.point, absolute));
        //else
        //    console.log(addVectors(bot.point, absolute))

    }
}


/**
 * send a POST request via HTTP to /post
 * @param varname name of variable to send
 * @param value command to send
 */
function POST_request(varname, value) {
    const msg = varname + "@" + value;
    requestThing(msg, function (m) {
        console.log(m);
    }, stdtimeout);
}

/**
 * send a GET request via HTTP
 * @param varname awaiting response on subpage /varname
 * @param callback after receiving data function(responseText)
 */
function GET_request(varname, callback) {
    requestThing(varname, callback, stdtimeout);
}


/**
 * @link https://learn.parallax.com/tutorials/language/propeller-c/parallax-wx-wi-fi-module-prop-c/send-web-page-event-info-propeller
 https://learn.parallax.com/tutorials/language/propeller-c/parallax-wx-wi-fi-module-prop-c/page-requests-info-propeller
 * @param path
 * @param param
 */
function httpPost(param) {

    const req = new XMLHttpRequest();
    //req.overrideMimeType("text/plain");
    req.open("POST", "connection.php", true);

    console.log("command",commandNumber+1,param + " sent");

    req.ontimeout = function (e) {
        console.log(param + " Timeout!!")
    };
    req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

    req.onload = function () {
        if (req.readyState == 4 && req.status == 200) {
            //success!
            //console.log(req.responseText,"- waiting for Bot response...");
        } else if (req.status != 200) {
            console.log("error ", req.status);
        }
        //console.log(req.responseText, req.status);
    }
    req.send("post=" + (++commandNumber) + ":" + param);
}

/**
 * @link https://learn.parallax.com/tutorials/language/propeller-c/parallax-wx-wi-fi-module-prop-c/page-requests-info-propeller
 * @param path listened to
 * @param callback function(responseText)
 */
function httpGet(command_number, callback) {
    theUrl = "connection.php?get=" + command_number;
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function () {
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
            callback(xmlHttp.responseText);
        else if (xmlHttp.status != 200 && xmlHttp.status != 0)
            console.log(xmlHttp.status, xmlHttp.responseText);
    }
    xmlHttp.ontimeout = function (e) {
        console.log(command_number + " Timeout!!")
    };
    xmlHttp.open("GET", theUrl, true); // true for asynchronous
    xmlHttp.send(null);
}

function requestThing(name, callback, timeout) {
    const c = commandNumber * 1+1;
    let t = timeout;
    httpPost(name);

    var iv = setInterval(function () {
        httpGet(c, function (message) {
            t -= 200;
            if(t<=0){
                console.error("Timeout on request nr.",c+":",name);
                robot_available = false;
                clearInterval(iv);
                document.getElementById("mousePosition").innerHTML = "---" + "<br>Roboter: " + (robot_available ? "" : "nicht") + " verfügbar";
            }
            //console.log(message,c);
            if (message !== "not recieved") {
                clearInterval(iv);
                callback(message);
                console.log("command", c,"recieved:",message);
                robot_available = true;
                document.getElementById("mousePosition").innerHTML = "---" + "<br>Roboter: " + (robot_available ? "" : "nicht") + " verfügbar";
            }

        });
        if(name != "cmd@X")
            sendstatus = false;
    }, 200);
    setTimeout(function () {
        sendstatus = true;
    }, timeout+300);

}
function clearQueue(){
    httpGet("clear",function(){
        commandNumber = -1;
    });
}
