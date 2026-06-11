const amqp = require('amqplib')
let channel


async function connect() {
  const conn = await amqp.connect(process.env.RABBITMQ_URL)
  channel = await conn.createChannel()
  await channel.assertExchange('users', 'topic', { durable: true })
  console.log('RabbitMQ conectado')
}


async function publish(routingKey, payload) {
  if (!channel) await connect()
  channel.publish('users', routingKey, Buffer.from(JSON.stringify(payload)), { persistent: true })
}


module.exports = { connect, publish }
