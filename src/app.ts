import express, { Express, Request, Response } from 'express';
import makeWaSocket from '@adiwajshing/baileys';
import { delay, useSingleFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@adiwajshing/baileys';
import dotenv from 'dotenv';
import socket from 'socket.io';
import http from 'http';
import { unlink, existsSync, mkdirSync } from 'fs';
import fs from 'fs';
import QrCode from 'qrcode';
import P from 'pino';
import path from 'path';

dotenv.config();
const ArfaPath = './ArfaSessions/'
const ArfaAuth = 'auth_info.json'

const app: Express = express();
app.use(express.static(__dirname + '/../public'));
app.use(express.static(__dirname));
app.set('view engine', 'ejs');
const port = process.env.PORT || 5500;
const httpServer = http.createServer(app);

const io = socket(httpServer, {
    path: '/socket.io',
});

app.get('/qr', (req: Request, res: Response) => {
    // const qr = req.query.qr || '';
    // for (const item of clientes) {
    //     item.emit('chegou-qr', qr);
    // }
    // res.status(200).json({
    //     ok: true
    // })
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

const clientes: Array<any> = [];

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
const dirBot = './bot'
if(!fs.existsSync(dirBot)){
    fs.mkdirSync(dirBot)
}

const ARFAGroupCheck = (jid) => {
    const regexp = new RegExp(/^\d{18}@g.us$/)
    return regexp.test(jid)
}

function exportQR (qrCode: any, path: any, socket: any) {
    const dumpQrCode = qrCode;
    qrCode = qrCode.replace('data:image/png;base64,', '');
    const imageBuffer = Buffer.from(qrCode, 'base64');
    fs.writeFileSync(path, imageBuffer);
    socket.emit('chegou-qr', dumpQrCode)
}

const ARFAUpdate = (ARFAsock, socket) => {
    const date = new Date(); // Start date
    const moment = date.getTime(); // Get TimeStamp
    ARFAsock.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        console.log("CONEXAO")
        console.log(connection)
        if(qr){
            const base64Qr = await QrCode.toDataURL(qr)
            exportQR(base64Qr, `public/qr/${moment}.png`, socket);
            console.log("BOT-ARFA-WHATSAPP - QrCode: ", qr)
        }
        if(connection === 'close') {
            const ARFAReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut
            if(ARFAReconnect) ARFAConnection()
            console.log(`BOT-ARFA-WHATSAPP -CONEXÃO FECHADA! RAZÃO: ${DisconnectReason.loggedOut.toString()}`)
            if(ARFAReconnect == false) {
                const removeAuth = ArfaPath + ArfaAuth
                unlink(removeAuth, err => {
                    if(err) throw err
                })
            }
        }
        if(connection === 'open') {
            console.log("BOT-ARFA-WHATSAPP - CONECTADO")
        }
    })
}

const ARFAConnection = async (socket) => {
    const { version } = await fetchLatestBaileysVersion()
    if(!existsSync(ArfaPath)) {
        mkdirSync(ArfaPath, {recursive: true})
    }
    const { saveState, state} = useSingleFileAuthState(ArfaPath + ArfaAuth)
    const config = {
        auth: state,
        logger: P({ level: 'error' }),
        printQRInTerminal: true,
        version,
        connectTimeoutMs: 60_000,
        browser: ['botwhatsapp', '', '3.0'],
        async getMessage(key) {
            return { conversation: 'botarfa' }
        },
    }
    const ARFAsock = makeWaSocket(config)
    ARFAUpdate(ARFAsock.ev, socket)
    ARFAsock.ev.on('creds.update', saveState)
    const ARFASendMessage = async (jid, msg) => {
        await ARFAsock.presenceSubscribe(jid)
        await delay(2000)
        await ARFAsock.sendPresenceUpdate('composing', jid)
        await delay(1500)
        await ARFAsock.sendPresenceUpdate('paused', jid)
        return await ARFAsock.sendMessage(jid, msg)
    }

    ARFAsock.ev.on('messages.upsert', async ({ messages, type }) => {
        const msg = messages[0]
        const ARFAUsuario = msg.pushName
        const jid = msg.key.remoteJid
        const conversation = msg.message.conversation
        
        if(!msg.key.fromMe && jid !== 'status@broadcast' && !ARFAGroupCheck(jid)) {
            const dirFrom = './bot/' + jid.replace(/\D/g, '')
            const from = jid.replace(/\D/g, '')
            function delay(t, v) {
                return new Promise(function(resolve) {
                    setTimeout(resolve.bind(null, v), t)
                })
            }
            async function readWriteFileJson(botStatus) {
                let dataFile = []
                fs.writeFileSync("./bot/" + from + "/bot.json", JSON.stringify(dataFile))
                var data = fs.readFileSync("./bot/" + from + "/bot.json")
                var myObject = JSON.parse(data)
                let newData = {
                    status: botStatus,
                }
                await myObject.push(newData)
                fs.writeFileSync("./bot/" + from + "/bot.json", JSON.stringify(myObject))
            }
            if(!fs.existsSync(dirFrom)){
                fs.mkdirSync(dirFrom)
                await fs.readWriteFileJson("on")
                console.log("bot on")
            }
            const status = fs.readFileSync("./bot/" + from + "/bot.json", "utf-8").split(":")[1].replace(/\W/g, "");
            if(conversation !== null && conversation.toUpperCase() === "C#") {
                await readWriteFileJson("on");
                ARFASendMessage(jid, { text: ARFAUsuario + ', BOT ON!' })
                .then(result => console.log('RESULT: ', result))
                .catch(err => console.log('ERROR: ', err))
            }else if (conversation !==null && conversation.toUpperCase() === "ARFABOT-OFF") {
                await readWriteFileJson("off");
                ARFASendMessage(jid, { text: ARFAUsuario + ', BOT OFF!' })
                .then(result => console.log('RESULT: ', result))
                .catch(err => console.log('ERROR: ', err))
                // Se quiser que o Bot Religue automático, descomente abaixo.
                // delay(tempoBot).then(async function () {
                //     await readWriteFileJson("on");
                //     ARFASendMessage(jid, { text: ARFAUsuario + ', BOT ON!' })
                //     .then(result => console.log('RESULT: ', result))
                //     .catch(err => console.log('ERROR: ', err))
                // });
            }else if (conversation !== null && conversation.toUpperCase() !== "C#" && conversation.toUpperCase() !== "ARFABOT-OFF") {
                // Aqui pode mandar aquelas mensagens de opções.
                // No momento não quero fazer nada.
            }
        }
    })
}

httpServer.listen(port, () => {
    console.log(`🛠️ [SERVER]: Server is running at http://localhost:${port}`);
    
});