import express from 'express'
import path from 'path'
import { createServer } from 'http'
import { Server } from 'socket.io'
import Filter from 'bad-words'
import { generateMessage, generateLocationMessage } from './util/messages.js'
import { addUser, removeUser, getUser, getUsersInRoom } from './util/users.js'

const app = express()
const server = createServer(app)
const io = new Server(server)

const port = process.env.PORT || 3000
console.log(port)
const __dirname = path.resolve()
const publicDirectoryPath = path.join(__dirname, 'public')

app.use(express.static(publicDirectoryPath))

io.on('connection', (socket) => {
  console.log(`New WebSocket connection`)

  socket.on('join', (options, callback) => {
    const { error, user } = addUser({ id: socket.id, ...options })

    if (error) {
      return callback(error)
    }

    socket.join(user.room)

    socket.emit('message', generateMessage('Admin', `Welcome!`))
    socket.broadcast
      .to(user.room)
      .emit('message', generateMessage('Admin', `${user.username} has joined!`))
    io.to(user.room).emit('roomData', {
      room: user.room,
      users: getUsersInRoom(user.room),
    })
  })

  socket.on('sendMessage', (msg, callback) => {
    const user = getUser(socket.id)
    const filter = new Filter()

    if (filter.isProfane(msg)) {
      return callback('Profanity is not allowed!')
    }

    io.to(user.room).emit('message', generateMessage(user.username, msg))
    callback()
  })

  socket.on('sendLocation', (cords, callback) => {
    const user = getUser(socket.id)
    io.to(user.room).emit(
      'locationMessage',
      generateLocationMessage(
        user.username,
        `https://google.com/maps?q=${cords.latitude},${cords.longitude}`
      )
    )
    callback()
  })

  socket.on('disconnect', () => {
    const user = removeUser(socket.id)

    if (user) {
      io.to(user.room).emit(
        'message',
        generateMessage('Admin', `${user.username} has left!`)
      )
      io.to(user.room).emit('roomData', {
        room: user.room,
        users: user.getUsersInRoom(user.room),
      })
    }
  })
})

server.listen(port, () => {
  console.log(`Listen on ${port} port!`)
})
