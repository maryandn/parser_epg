const axios = require('axios')
const dayjs = require('dayjs')

module.exports = {
    site: 'mts.rs',
    days: 3,
    url({date}) {
        return `https://mts.rs/hybris/ecommerce/b2c/v1/products/search?sort=pozicija-rastuce&searchQueryContext=CHANNEL_PROGRAM&query=:pozicija-rastuce:tip-kanala-radio:TV kanali:channelProgramDates:${date.format(
            'YYYY-MM-DD'
        )}&pageSize=10000`
    },
    request: {
        maxContentLength: 50 * 1024 * 1024 // 50 Mb
    },
    parser({content, channel}) {
        const items = parseItems(content, channel)

        return items.map(item => {
            return {
                title: item.title,
                category: item.category,
                description: item.description,
                image: item?.picture?.url || null,
                start: dayjs(item.start),
                stop: dayjs(item.end)
            }
        })
    },
    async channels() {
        const data = await axios
            .get(module.exports.url({date: dayjs()}))
            .then(r => r.data)
            .catch(console.error)

        return data.products.map(channel => ({
            lang: 'bs',
            name: channel.name,
            site_id: encodeURIComponent(channel.code)
        }))
    }
}

function parseItems(content, channel) {
    try {
        const data = JSON.parse(content)
        if (!data || !Array.isArray(data.products)) return []

        const decodedId = decodeURIComponent(channel.site_id)

        const channelData = data.products.find(c => c.code === decodedId)
        if (!channelData || !Array.isArray(channelData.programs)) return []

        channelData.programs.forEach(p => {
            p.start = p.start.replace('+01:00', '+02:00')
            p.end = p.end.replace('+01:00', '+02:00')
        })

        return channelData.programs
    } catch {
        return []
    }
}
