const express = require('express')
const cors = require('cors');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 3000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


// mongobd info 

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vcvzka8.mongodb.net/?appName=Cluster0`;

// middleware
app.use(express.json());
app.use(cors());

// 1.varify firbase token 
var admin = require("firebase-admin");

var serviceAccount = require("./firebase_admin_token.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


// 2.verify firebase token 
const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
      return res.status(401).send({ message: 'unauthorized access' })
  }

  try {
      const idToken = token.split(' ')[1];
      const decoded = await admin.auth().verifyIdToken(idToken);
      console.log('decoded in the token', decoded);
      req.decoded_email = decoded.email;
      next();
  }
  catch (err) {
      return res.status(401).send({ message: 'unauthorized access' })
  }


}



// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });



//   mongodb function 
  async function run() {
    try {
      // Connect the client to the server	(optional starting in v4.7)
      await client.connect();

     const db = client.db('clubsphere');
     const userCollection = db.collection('users');


    //  / verify admin 

        const verifyAdmin = async (req, res, next) => {
          const email = req.decoded_email;
          const query = {email};
          const user = await userCollection.findOne(query);

          if (!user || !['admin'].includes(user.role)) {
            return res.status(403).send({ message: 'forbidden access' });
          }
        
          next();
        };

        //verifyClubManageer
        const verifyClubManageer = async (req, res, next) => {
          const email = req.decoded_email;
          const query = {email};
          const user = await userCollection.findOne(query);

          if (!user || !['club-manager'].includes(user.role)) {
            return res.status(403).send({ message: 'forbidden access' });
          }
        
          next();
        };


    //  users api 

    //get all users list

        // users related apis
        app.get('/users',verifyFBToken, async (req, res) => {
          const searchText = req.query.searchText;
          const query = {};

          if (searchText) {
              query.$or = [
                  { displayName: { $regex: searchText, $options: 'i' } },
                  { email: { $regex: searchText, $options: 'i' } },
              ]

          }

          const cursor = userCollection.find(query).sort({ createdAt: -1 }).limit(10);
          const result = await cursor.toArray();
          res.send(result);
      });

// users role for dashboard 
app.get('/users/:email/role',verifyFBToken,  async (req, res) => {
  const email = req.params.email;

   if (email !== req.decoded_email) {
    return res.status(403).send({ message: 'forbidden access' });
  }

  const user = await userCollection.findOne({ email });
   res.send({ role: user?.role || 'member' });
});




    // create and add users 
     app.post('/users', async (req, res) => {
        const user = req.body;
        user.role = 'member';
        user.createdAt = new Date();
        const email = user.email;
        const userExists = await userCollection.findOne({ email })

        if (userExists) {
            return res.send({ message: 'User altrady Registered' })
        }

        const result = await userCollection.insertOne(user);
        res.send(result);
    })

    //patch update users 
    app.patch('/users/:id/role', verifyFBToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const roleInfo = req.body;
      const query = { _id: new ObjectId(id) }
      const updatedDoc = {
          $set: {
              role: roleInfo.role
          }
      }
      const result = await userCollection.updateOne(query, updatedDoc)
      res.send(result);
  })



      // Send a ping to confirm a successful connection
      await client.db("admin").command({ ping: 1 });
      console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
     
    }
  }
  run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Welcome to ClubSphere!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})