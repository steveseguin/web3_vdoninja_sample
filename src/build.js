const { retrieveData, sendData, SingleNodeClient } = require("@iota/iota.js");
const { Converter }  = require("@iota/util.js");
var IOTA = {};
IOTA.retrieveData = retrieveData;
IOTA.sendData = sendData;
IOTA.Converter = Converter;
IOTA.SingleNodeClient = SingleNodeClient;