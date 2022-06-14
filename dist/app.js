"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const baileys_1 = __importDefault(require("@adiwajshing/baileys"));
const baileys_2 = require("@adiwajshing/baileys");
const dotenv_1 = __importDefault(require("dotenv"));
const socket_io_1 = __importDefault(require("socket.io"));
const http_1 = __importDefault(require("http"));
const fs_1 = require("fs");
const fs_2 = __importDefault(require("fs"));
const qrcode_1 = __importDefault(require("qrcode"));
const pino_1 = __importDefault(require("pino"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const ArfaPath = './ArfaSessions/';
const ArfaAuth = 'auth_info.json';
const app = (0, express_1.default)();
app.use(express_1.default.static(__dirname + '/../public'));
app.use(express_1.default.static(__dirname));
app.set('view engine', 'ejs');
const port = process.env.PORT || 5500;
const httpServer = http_1.default.createServer(app);
const io = (0, socket_io_1.default)(httpServer, {
    path: '/socket.io',
});
app.get('/qr', (req, res) => {
    // const qr = req.query.qr || '';
    // for (const item of clientes) {
    //     item.emit('chegou-qr', qr);
    // }
    // res.status(200).json({
    //     ok: true
    // })
    res.sendFile(path_1.default.join(__dirname, '../public/index.html'));
});
const clientes = [];
io.on('connection', (socket) => {
    console.log(`Cliente conectado: ${socket.id}`);
    clientes.push(socket);
    //ARFAConnection(socket);
    socket.on('disconnect', () => {
        clientes.slice(clientes.indexOf(socket), 1);
        console.log(`Cliente desconectado: ${socket.id}`);
    });
});
// Configurações do bot
const dirBot = './bot';
if (!fs_2.default.existsSync(dirBot)) {
    fs_2.default.mkdirSync(dirBot);
}
const ARFAGroupCheck = (jid) => {
    const regexp = new RegExp(/^\d{18}@g.us$/);
    return regexp.test(jid);
};
function exportQR(qrCode, path, socket) {
    const dumpQrCode = qrCode;
    qrCode = qrCode.replace('data:image/png;base64,', '');
    const imageBuffer = Buffer.from(qrCode, 'base64');
    fs_2.default.writeFileSync(path, imageBuffer);
    socket.emit('chegou-qr', dumpQrCode);
}
const ARFAUpdate = (ARFAsock, socket) => {
    const date = new Date(); // Start date
    const moment = date.getTime(); // Get TimeStamp
    ARFAsock.on('connection.update', ({ connection, lastDisconnect, qr }) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        console.log("CONEXAO");
        console.log(connection);
        if (qr) {
            const base64Qr = yield qrcode_1.default.toDataURL(qr);
            exportQR(base64Qr, `public/qr/${moment}.png`, socket);
            console.log("BOT-ARFA-WHATSAPP - QrCode: ", qr);
        }
        if (connection === 'close') {
            const ARFAReconnect = ((_b = (_a = lastDisconnect.error) === null || _a === void 0 ? void 0 : _a.output) === null || _b === void 0 ? void 0 : _b.statusCode) !== baileys_2.DisconnectReason.loggedOut;
            if (ARFAReconnect)
                ARFAConnection();
            console.log(`BOT-ARFA-WHATSAPP -CONEXÃO FECHADA! RAZÃO: ${baileys_2.DisconnectReason.loggedOut.toString()}`);
            if (ARFAReconnect == false) {
                const removeAuth = ArfaPath + ArfaAuth;
                (0, fs_1.unlink)(removeAuth, err => {
                    if (err)
                        throw err;
                });
            }
        }
        if (connection === 'open') {
            console.log("BOT-ARFA-WHATSAPP - CONECTADO");
        }
    }));
};
const ARFAConnection = (socket) => __awaiter(void 0, void 0, void 0, function* () {
    const { version } = yield (0, baileys_2.fetchLatestBaileysVersion)();
    if (!(0, fs_1.existsSync)(ArfaPath)) {
        (0, fs_1.mkdirSync)(ArfaPath, { recursive: true });
    }
    const { saveState, state } = (0, baileys_2.useSingleFileAuthState)(ArfaPath + ArfaAuth);
    const config = {
        auth: state,
        logger: (0, pino_1.default)({ level: 'error' }),
        printQRInTerminal: true,
        version,
        connectTimeoutMs: 60000,
        browser: ['botwhatsapp', '', '3.0'],
        getMessage(key) {
            return __awaiter(this, void 0, void 0, function* () {
                return { conversation: 'botarfa' };
            });
        },
    };
    const ARFAsock = (0, baileys_1.default)(config);
    ARFAUpdate(ARFAsock.ev, socket);
    ARFAsock.ev.on('creds.update', saveState);
    const ARFASendMessage = (jid, msg) => __awaiter(void 0, void 0, void 0, function* () {
        yield ARFAsock.presenceSubscribe(jid);
        yield (0, baileys_2.delay)(2000);
        yield ARFAsock.sendPresenceUpdate('composing', jid);
        yield (0, baileys_2.delay)(1500);
        yield ARFAsock.sendPresenceUpdate('paused', jid);
        return yield ARFAsock.sendMessage(jid, msg);
    });
    ARFAsock.ev.on('messages.upsert', ({ messages, type }) => __awaiter(void 0, void 0, void 0, function* () {
        const msg = messages[0];
        const ARFAUsuario = msg.pushName;
        const jid = msg.key.remoteJid;
        const conversation = msg.message.conversation;
        if (!msg.key.fromMe && jid !== 'status@broadcast' && !ARFAGroupCheck(jid)) {
            const dirFrom = './bot/' + jid.replace(/\D/g, '');
            const from = jid.replace(/\D/g, '');
            function delay(t, v) {
                return new Promise(function (resolve) {
                    setTimeout(resolve.bind(null, v), t);
                });
            }
            function readWriteFileJson(botStatus) {
                return __awaiter(this, void 0, void 0, function* () {
                    let dataFile = [];
                    fs_2.default.writeFileSync("./bot/" + from + "/bot.json", JSON.stringify(dataFile));
                    var data = fs_2.default.readFileSync("./bot/" + from + "/bot.json");
                    var myObject = JSON.parse(data);
                    let newData = {
                        status: botStatus,
                    };
                    yield myObject.push(newData);
                    fs_2.default.writeFileSync("./bot/" + from + "/bot.json", JSON.stringify(myObject));
                });
            }
            if (!fs_2.default.existsSync(dirFrom)) {
                fs_2.default.mkdirSync(dirFrom);
                yield fs_2.default.readWriteFileJson("on");
                console.log("bot on");
            }
            const status = fs_2.default.readFileSync("./bot/" + from + "/bot.json", "utf-8").split(":")[1].replace(/\W/g, "");
            if (conversation !== null && conversation.toUpperCase() === "C#") {
                yield readWriteFileJson("on");
                ARFASendMessage(jid, { text: ARFAUsuario + ', BOT ON!' })
                    .then(result => console.log('RESULT: ', result))
                    .catch(err => console.log('ERROR: ', err));
            }
            else if (conversation !== null && conversation.toUpperCase() === "ARFABOT-OFF") {
                yield readWriteFileJson("off");
                ARFASendMessage(jid, { text: ARFAUsuario + ', BOT OFF!' })
                    .then(result => console.log('RESULT: ', result))
                    .catch(err => console.log('ERROR: ', err));
                // Se quiser que o Bot Religue automático, descomente abaixo.
                // delay(tempoBot).then(async function () {
                //     await readWriteFileJson("on");
                //     ARFASendMessage(jid, { text: ARFAUsuario + ', BOT ON!' })
                //     .then(result => console.log('RESULT: ', result))
                //     .catch(err => console.log('ERROR: ', err))
                // });
            }
            else if (conversation !== null && conversation.toUpperCase() !== "C#" && conversation.toUpperCase() !== "ARFABOT-OFF") {
                // Aqui pode mandar aquelas mensagens de opções.
                // No momento não quero fazer nada.
            }
        }
    }));
});
httpServer.listen(port, () => {
    console.log(`🛠️ [SERVER]: Server is running at http://localhost:${port}`);
});
