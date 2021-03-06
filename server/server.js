/*
 * import sys
 * import base64
 * import requests
 * import json
 *
 * file_path = "integral.jpg"
 * image_uri = "data:image/jpg;base64," + base64.b64encode(open(file_path, "rb").read()).decode()
 * r = requests.post("https://api.mathpix.com/v3/latex",
 *     data=json.dumps({'src': image_uri, 'ocr': ["math", "text"]}),
 *         headers={"app_id": "trial", "app_key": "34f1a4cea0eaca8540c95908b4dc84ab",
 *                 "Content-type": "application/json"})
 *                 print(r.text)
 **/

const fetch = require('node-fetch')
const express = require('express')
const app = express()
app.use(express.json({limit: '15mb'}))

const MATHPIX_ID = process.env.MATHPIX_ID
const MATHPIX_KEY = process.env.MATHPIX_KEY
const WOLFRAM_ID = process.env.WOLFRAM_ID
const TWILIO_ID = process.env.TWILIO_ID
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN

const twilio_client = require('twilio')(TWILIO_ID, TWILIO_AUTH_TOKEN);

let latex = undefined
let results = ""

function sendMathPix(img, cb) {
    fetch('https://api.mathpix.com/v3/latex', {
        method: 'post',
        headers: {
            "app_id": MATHPIX_ID, "app_key": MATHPIX_KEY,
            "Content-type": "application/json"
        },
        body: JSON.stringify({
            'src': img,
            'ocr': ['math', 'text']
        })
    }).then(res => res.json())
    .then( d => {
        latex = d.latex || undefined
        console.log(latex)
        cb()
    }).catch((err) => { throw err })
}

function sendWolfram(res, raw) {
    // // parse wolfram results
    latex = raw ? latex : latex.split(' {').join('{')
    let encoded_latex = encodeURIComponent(latex) // strips whitespace from latex
    let call = `https://api.wolframalpha.com/v2/query?input=${encoded_latex}&format=plaintext&output=JSON&appid=${WOLFRAM_ID}`
    fetch(call).then(e=>
        e.json()
    ).then(d=>{
        if (d.queryresult.success && d.queryresult.numpods > 0) {
            console.log("query ok "+JSON.stringify(d.queryresult))
            for (let i = 0; i < d.queryresult.pods.length; i++) {
                if (d.queryresult.pods[i].title ==  "Result"){
                    console.log(d.queryresult.pods[i].subpods[0].plaintext)
                    res.send(d.queryresult.pods[i].subpods[0].plaintext)
                } else if (d.queryresult.pods[i].title == "Definite integral") {
                    console.log(d.queryresult.pods[i].subpods[0].plaintext)
                    let ans = d.queryresult.pods[i].subpods[0].plaintext
                    ans = ans.split('...')[0]
                    if(ans.includes('=')){
                        ans = ans.split('≈')[0]
                        ans = ans.split('=')[1]
                    } else if (ans.includes('≈')) {
                        ans = ans.split('≈')[1]
                    }
                    res.send(ans)
                }
            }
        }
        console.log("empty string")
        res.send("")
    }).catch (e=>{
        console.log(e)
        res.send(e)
    })
}

app.get('/test', (req, res) => {
    res.status(200).send()
})
// get image
app.post('/image', (req, res) => {
    // console.log(req.body.image)
    try {
        sendMathPix(req.body.image, () => sendWolfram(res, false)) // promises are overrated
    } catch(err) {
        console.log(err)
        res.status(500).send({ message: "error processing image" })
    }
})

// get latex
app.get('/latex', (req, res) => {
    let temp = latex
    latex = undefined
    if (temp) res.send(temp)
    res.status(404).send({ message: "No latex found" })
})
app.post('/latex', (req, res) => {
    latex = req.body.latex
    console.log(req.body.latex)
    sendWolfram(res, true)
})

// get wolfram results
app.get('/results', (req, res) => {
    let temp = results
    results = ""
    if (temp > 0)
        res.json({ results: temp })
    res.status(404).send({ message: "No results found" })
})

let twilio_message = ""
app.post('/twiliog', (req, res) => {
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>${twilio_message}</Say></Response>`)
})
app.post('/twilio', (req, res) => {
    twilio_message = req.body.message
    twilio_client.calls.create({
        url: 'http://math-alexa.appspot.com/twiliog',
        to: '+14157697259',
        from: '+14692995709',
    })
    console.log(twilio_message)
    res.status(200).send()
})

app.listen(process.env.PORT || 3000, (req, res) => {
    console.log(`listening on port ${process.env.PORT || 3000}`)
})