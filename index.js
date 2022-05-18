const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bmgay.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run() {
    try {
        await client.connect();
        const servicesCollection = client.db('doctors_portal').collection('services')
        const bookingCollection = client.db('doctors_portal').collection('booking')
        const userCollection = client.db('doctors_portal').collection('users')

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email }
            const options = { upsert: true }
            const updatedDoc = {
                $set: user,
            }
            const result = await userCollection.updateOne(filter, updatedDoc, options)
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
            res.send({ result, token });
        })


        app.get('/services', async (req, res) => {
            const query = {}

            const result = await servicesCollection.find(query).toArray()
            res.send(result)
        })

        // WARNING!!!
        // This is not the proper way to query
        // after learning more about mongodb. use aggregate, lookup, pipeline, match, group
        app.get('/available', async (req, res) => {
            const date = req.query.date;

            // 1. get alll services

            const services = await servicesCollection.find().toArray()

            // 2. get the bookings of that day
            const query = { date: date };
            const bookings = await bookingCollection.find(query).toArray()

            // 3. for each service, find bookings for that service
            services.forEach(service => {
                const serviceBooking = bookings.filter(b => b.treatment === service.name);
                const booked = serviceBooking.map(s => s.slot);
                const available = service.slots.filter(s => !booked.includes(s))
                service.slots = available
            })

            res.send(services)
        })

        /**
         * API Naming Convention
         * app.get('/booking') get all bookings in this collection or get more than one
         * app.get('/booking:id') // get a specific booking
         * app.post('/booking') // add a new booking
         * app.patch('/booking:id')  
         * app.put('/booking/:id') // upsert ==> update(if exists) or insert (if doesn't exist)
         * app.delete('/booking:id') 
        */

        app.get('/booking', async (req, res) => {
            const patient = req.query.patient
            const query = { patient };
            const bookings = await bookingCollection.find(query).toArray()
            res.send(bookings);
        })

        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exists = await bookingCollection.findOne(query)
            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            const result = await bookingCollection.insertOne(booking);
            return res.send({ success: true, result });
        })

    }
    finally {

    }
}
run().catch(console.dir)


app.get('/', (req, res) => {
    res.send('Hello From Doctors Portal')
})

app.listen(port, () => {
    console.log(`App listening on port ${port}`)
})