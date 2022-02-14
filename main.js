// Copyright Steve Seguin
//////////////////////////

(function(w) {
	w.URLSearchParams = w.URLSearchParams || function(searchString) {
		var self = this;
		searchString = searchString.replace("??", "?");
		self.searchString = searchString;
		self.get = function(name) {
			var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(self.searchString);
			if (results == null) {
				return null;
			} else {
				return decodeURI(results[1]) || 0;
			}
		};
	};

})(window);

var urlEdited = window.location.search.replace(/\?\?/g, "?");
urlEdited = urlEdited.replace(/\?/g, "&");
urlEdited = urlEdited.replace(/\&/, "?");

if (urlEdited !== window.location.search){
	warnlog(window.location.search + " changed to " + urlEdited);
	window.history.pushState({path: urlEdited.toString()}, '', urlEdited.toString());
}
var urlParams = new URLSearchParams(urlEdited);
var sendQueue = [];
var sending = false;

if (urlParams.has("room")){
	var roomid = urlParams.get("room");
} else {
	var roomid = prompt("This app needs a room name");
}

IOTA.api =  "https://chrysalis-nodes.iota.org";

IOTA.init = function (API_ENDPOINT = false){
	if (API_ENDPOINT){
		IOTA.client = new IOTA.SingleNodeClient(API_ENDPOINT);
	} else {
		IOTA.client = new IOTA.SingleNodeClient(IOTA.api);
	}
}	

IOTA.send = async function(message, UUID){
	if (!IOTA.client){
		IOTA.init();
	}
    const index = IOTA.Converter.utf8ToBytes(UUID.toString());
	var msg = {m:message, t:Date.now()};
	var packed = JSON.stringify(msg);
	sendQueue.push([index, IOTA.Converter.utf8ToBytes(packed)]);
	await IOTA.serialSend();
};

IOTA.serialSend = async function(){
	if (sending){return}
	sending = true;
	while (sendQueue.length){
		var msg = sendQueue.shift();
		try {
			var sent = await IOTA.sendData(IOTA.client, msg[0], msg[1]);
			if (!sent){
				console.error("Did not send; unshifting");
				sendQueue.unshift(msg);
				continue;
			}
		} catch(e){
			console.error(e);
			sendQueue.unshift(msg);
		}
	}
	sending = false;
}

IOTA.query = async function(UUID, getValue=true){
	const index = IOTA.Converter.utf8ToBytes(UUID.toString());
    const found = await IOTA.client.messagesFind(index);
	if (!IOTA.history){
		IOTA.history = {};
		IOTA.history[UUID] = [];
	} else if (!(UUID in IOTA.history)){
		IOTA.history[UUID] = [];
	}
	console.log(found);
	var results = [];
    if (found && found.messageIds.length > 0) {
		for (var i=0;i<found.messageIds.length;i++){
			if (IOTA.history[UUID].includes(found.messageIds[i])){continue;}
			IOTA.history[UUID].push(found.messageIds[i]);
			if (!getValue){continue;} // do not get values;
			
			try {
				const firstResult = await IOTA.retrieveData(IOTA.client, found.messageIds[i]);
				if (firstResult) {
					results.push(firstResult.data ? IOTA.Converter.bytesToUtf8(firstResult.data) : "None");
				} else {
					console.error("What?");
				}
			} catch(e){ // failed. Will retry again next time.
				console.error(e);
				const idx = IOTA.history[UUID].indexOf(found.messageIds[i]);
				if (idx > -1) {
					IOTA.history[UUID].splice(idx, 1); // 2nd parameter means remove one item only
				}
			}
		}
    }
	return results;
}

async function checkForMessages(UUID, send=true){
	try {
		if (!IOTA.client){
			IOTA.init();
		}
		var results = await IOTA.query(UUID, send);
		if (!send){
			setTimeout(function(rid){checkForMessages(rid, true);},1000, roomid);
			return;}
		if (!results.length){
			setTimeout(function(rid){checkForMessages(rid, true);},1000, roomid);
			return;}
		for (var i=0;i<results.length;i++){
			try {
				var msg = JSON.parse(results[i]);
				if (!msg.t || !msg.m){continue;} // not what we are expecting
				if (Date.now() - msg.t>666000){continue;} // DTLS not valid anymore; 10 +/- 1 minutes, unix time stamp.
				//console.log(JSON.parse(msg.m));
			} catch(e){continue;}
			iframe.contentWindow.postMessage({"function":"routeMessage", "value":msg.m}, '*'); // 
		}
	} catch(e){console.error(e);}
	setTimeout(function(rid){checkForMessages(rid, true);},1000, roomid);
}

checkForMessages(roomid, false); // clear existing messages.

var iframe = document.createElement("iframe");
iframe.allow = "autoplay;camera;microphone;fullscreen;picture-in-picture;display-capture;";
iframe.src = "../?bypass&password=iOTAtest123&room="+roomid;
iframe.style.width="100%";
iframe.style.height="100%";

var eventMethod = window.addEventListener ? "addEventListener" : "attachEvent";
var eventer = window[eventMethod];
var messageEvent = eventMethod === "attachEvent" ? "onmessage" : "message";
eventer(messageEvent, function (e) {
	if (e.source != iframe.contentWindow){return;}
	if ("bypass" in e.data){
		IOTA.send(e.data.bypass, roomid);
	}
});
document.getElementById("body").appendChild(iframe);
