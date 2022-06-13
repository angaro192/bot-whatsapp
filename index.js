const makeWaSocket =  require('@adiwajshing/baileys').default
const { delay, useSingleFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@adiwajshing/baileys')
const { unlink, existsSync, mkdirSync } = require('fs')
const P = require('pino')
const ArfaPath = './ArfaSessions/'
const ArfaAuth = 'auth_info.json'
const fs = require('fs')
const tempoBot = 10000

const QrCode = require("qrcode")

const dirBot = './bot'
if(!fs.existsSync(dirBot)){
    fs.mkdirSync(dirBot)
}

const ARFAGroupCheck = (jid) => {
    const regexp = new RegExp(/^\d{18}@g.us$/)
    return regexp.test(jid)
}

function exportQR(qrCode, path) {
    qrCode = qrCode.replace('data:image/png;base64,', '');
    const imageBuffer = Buffer.from(qrCode, 'base64');
    fs.writeFileSync(path, imageBuffer);
    //io.sockets.emit("qrcode "+user_id, chat_id);      
 }

const ARFAUpdate = (ARFAsock) => {
    const date = new Date(); // Start date
    const moment = date.getTime(); // Get TimeStamp
    ARFAsock.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        console.log("CONEXAO")
        console.log(connection)
        if(qr){
            const base64Qr = await QrCode.toDataURL(qr)
            exportQR(base64Qr, `public/${moment}.png`);
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

const ARFAConnection = async () => {
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
        browser: ['augustalmeid@gmail.com', '', '3.0'],
        async getMessage(key) {
            return { conversation: 'botarfa' }
        },
    }
    const ARFAsock = makeWaSocket(config)
    ARFAUpdate(ARFAsock.ev)
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

ARFAConnection()