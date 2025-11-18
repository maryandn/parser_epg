const axios = require('axios')
const cheerio = require('cheerio')
const dayjs = require('dayjs')

module.exports = {
    site: 'movistarplus.es',
    days: 3,
    url({ channel, date }) {
        return `https://www.movistarplus.es/programacion-tv/${channel.site_id}/${date.format('YYYY-MM-DD')}`
    },
    request: {
        headers: {
            'user-agent':
                'Mozilla/5.0 (Linux; Linux x86_64) AppleWebKit/600.3 (KHTML, like Gecko) Chrome/48.0.2544.291 Safari/600'
        }
    },
    async parser({ content, date })  {

        const $ = cheerio.load(content)
        let programs = []

        const programElements = $('div[id^="ele-"]')

        let currentDay = dayjs(date).startOf('day')
        let nextDay = dayjs(date).startOf('day')

        let prevHH = null
        let prevMM = null

        const extracted = []

        programElements.each((i, elem) => {
            const programDiv = $(elem)

            const title = programDiv.find('li.title').text().trim() || null
            const time = programDiv.find('li.time').text().trim()

            extracted.push({ title, time, elem: programDiv })
        })

        for (let i = 0; i < extracted.length; i++) {

            if (i === extracted.length - 1) {
                break
            }

            const currentTitle = extracted[i].title
            const currentTime = extracted[i].time
            const currentElem = extracted[i].elem
            const nextTime = extracted[i + 1].time

            let [currentHH, currentMM] = currentTime.split(':').map(Number)
            let [nextHH, nextMM] = nextTime.split(':').map(Number)

            if (prevHH !== null) {
                if (currentHH < prevHH || (currentHH === prevHH && currentMM < prevMM)) {
                    currentDay = currentDay.add(1, 'day')
                }
            }
            let start = currentDay.hour(currentHH).minute(currentMM).second(0).millisecond(0)

            if (nextHH < currentHH || (nextHH === currentHH && nextMM < currentMM)) {
                nextDay = currentDay.add(1, 'day')
            } else {
                nextDay = currentDay
            }
            let stop = nextDay.hour(nextHH).minute(nextMM).second(0).millisecond(0)

            let description = null
            const programLink = currentElem.find('a').attr('href')

            if (programLink) {
                description = await getProgramDescription(programLink).catch(() => null)
            }

            programs.push({
                title: currentTitle,
                description,
                start,
                stop
            })
            prevHH = currentHH
            prevMM = currentMM
        }
        return programs
    },

    async channels() {
        const html = await axios
            .get('https://www.movistarplus.es/programacion-tv')
            .then(r => r.data)
            .catch(console.log)

        const $ = cheerio.load(html)
        let scheme = $('script:contains(ItemList)').html()
        scheme = JSON.parse(scheme)

        return scheme.itemListElement.map(el => {
            const urlParts = el.item.url.split('/')
            const site_id = urlParts.pop().toLowerCase()

            return {
                lang: 'es',
                name: el.item.name,
                site_id
            }
        })
    }
}

async function getProgramDescription(programUrl) {
    try {
        const response = await axios.get(programUrl, {
            headers: {
                'Referer': 'https://www.movistarplus.es/programacion-tv/'
            }
        })

        const $ = cheerio.load(response.data)
        const description = $('.show-content .text p').first().text().trim() || null

        return description
    } catch (error) {
        console.error(`Error fetching description from ${programUrl}:`, error.message)
        return null
    }
}