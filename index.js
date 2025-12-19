const express = require('express');
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

// var serviceAccount = require("./firebase_admin_token.json");


// const serviceAccount = require("./firebase-admin-key.json");

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded);

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
     const cityCollection = db.collection('cities');
     const categoryCollection = db.collection('categories');
     const clubsCollection = db.collection('clubs');
     const eventsCollection = db.collection('events')

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
        const verifyClubManager = async (req, res, next) => {
          const email = req.decoded_email;
          
          const query = {email};
          const user = await userCollection.findOne(query);

          if (!user || !['club-manager'].includes(user.role)) {
            return res.status(403).send({ message: 'forbidden access' });
          }
        
          next();
        };



        //EVENTS API 
 
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




  //geting available cities
  app.get('/cities',async (req, res) => {
  
  const result = await cityCollection.find().toArray();
   res.send(result);
});


//getting all category
  app.get('/categories',async (req, res) => {
  
    const result = await categoryCollection.find().toArray();
     res.send(result);
  });


  //create category
  app.post('/category',verifyFBToken,verifyAdmin, async(req,res)=>{

    const categoryData = req.body;
    const email = req.decoded_email; // or from token: req.decoded_email

  
    const user = await userCollection.findOne({ email: email });

    if (!user) {
        return res.status(404).send({ message: 'User not found' });
    }

    // Only allow if role is 'club manager'
    if (user.role !== 'admin') {
        return res.status(403).send({ message: 'Access forbidden: only Admin can create category' });
    }

    // Set default values
    categoryData.status = 'Active';
    categoryData.createdAt = new Date();

    const result = await categoryCollection.insertOne(categoryData);

    if (result.insertedId) {
        return res.status(201).send({ insertedId: result.insertedId, message: 'Category created successfully' });
    } else {
        return res.status(500).send({ message: 'Failed to create category' });
    }


  })
  


  // clbus related api 

  // clubs create 

  app.post('/clubs', verifyFBToken, async (req, res) => {
   
        const clubData = req.body;
        const email = clubData.managerEmail; // or from token: req.decoded_email

      
        const user = await userCollection.findOne({ email: email });

        if (!user) {
            return res.status(404).send({ message: 'User not found' });
        }

        // Only allow if role is 'club manager'
        if (user.role !== 'club-manager') {
            return res.status(403).send({ message: 'Access forbidden: only club managers can create clubs' });
        }
// set category id 


        // Set default values
        clubData.status = 'pending';
        clubData.createdAt = new Date();
        

        const result = await clubsCollection.insertOne(clubData);

        if (result.insertedId) {
            return res.status(201).send({ insertedId: result.insertedId, message: 'Club created successfully' });
        } else {
            return res.status(500).send({ message: 'Failed to create club' });
        }

  
});

// get clubs 
app.get('/clubs', async(req,res)=>{

  const result = await clubsCollection.find().toArray();
  return res.send(result)
})


// get club by id 
app.get('/club/:id', async(req,res)=>{
  const id =req.params;

  const query= {
    _id: new ObjectId(id)};

  const club = await clubsCollection.findOne(query)

  return res.send(club)


})
//calling created clubs by looged manager who create that

app.get('/myclubs/:email', verifyFBToken, async (req, res) => {
  const email = req.params.email;

  // security check
  if (email !== req.decoded_email) {
    return res.status(403).send({ message: 'forbidden access' });
  }

  const query = { managerEmail: email };
  const myClubs = await clubsCollection.find(query).sort({createdAt: -1}).toArray();

  res.send(myClubs);
});



// upate clubs 
// step 1 call to set default value
app.get('/clubs/:id', verifyFBToken, async (req, res) => {
  const id = req.params.id;
  const club = await clubsCollection.findOne({ _id: new ObjectId(id) });
  res.send(club);
});



// step 2 after change patch now
app.patch('/clubs/:id', verifyFBToken, verifyClubManager, async (req, res) => {
    const { id } = req.params;
    const email = req.decoded_email;
    const updatedData = req.body;


    const club = await clubsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!club) {
      return res.status(404).send({ message: 'Club not found' });
    }


    if (club.managerEmail !== email) {
      return res.status(403).send({ message: 'Forbidden access' });
    }


    const updateDoc = {
      $set: {
        clubName: updatedData.clubName,
        description: updatedData.description,
        category: updatedData.category,
        membershipFee: updatedData.membershipFee,
        updatedAt: new Date(),
      },
    };

 const result = await clubsCollection.updateOne(
      { _id: new ObjectId(id) },
      updateDoc
    );

    res.send(result);
  }
);


// category by id 
app.get('/categories/:id', async (req, res) => {
  const { id } = req.params;
  const category = await categoryCollection.findOne({ _id: new ObjectId(id) });
  res.send(category);
});

// get category wise club 
app.get('/categories/:categoryId/clubs', async (req, res) => {
  try {
    const categoryId = req.params;
    const query = { categoryId: new ObjectId(categoryId) };
    const clubs = await clubsCollection.find(query).toArray();
    res.send(clubs);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Invalid category ID or server error' });
  }
});


//delete listed manager club
    app.delete('/clubs/:id', verifyFBToken, verifyClubManager, async (req, res) =>{

      const {id} = req.params;
      

      const query = {_id: new ObjectId(id)}

      const result = await clubsCollection.deleteOne(query);
      res.send(result);


    });

    //all reqted clubs show

    app.get('/pendingClubs/:email', verifyFBToken, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded_email) {
    return res.status(403).send({ message: 'Forbidden access' });
  }

  

      // const query = { status: { $ne: 'rejected' } };

    // events api 
   
     
    
      // const query = { managerEmail: email };
      const pendingClubs = await clubsCollection.find({status:{$ne:'rejected'} }).sort({createdAt: -1 }).toArray();
    
      res.send(pendingClubs);
    });
    
    
  
    
  
     
  // });


  // approved pendingclubs 
  app.patch('/pendingclubs/:id',verifyFBToken, verifyAdmin,  async (req, res) => {
    const status = req.body.status;
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };

  

    const updateDoc = {
      $set: { status: status}
    };
    const result = await clubsCollection.updateOne(query, updateDoc);

    if (result.modifiedCount === 1) {
      res.send({ success: true, message: 'Club Approved successfully' });
    } else {
      res.status(404).send({ success: false, message: 'Club not found' });
    }
  

   
});



  //  event route 
          
  app.post('/events', verifyFBToken, verifyClubManager, async (req, res) => {
   
    const eventInfo = req.body;
    const email = eventInfo.managerEmail; // or from token: req.decoded_email

  
    const user = await userCollection.findOne({ email: email });

    if (!user) {
        return res.status(404).send({ message: 'User not found' });
    }

    // Only allow if role is 'club manager'
    if (user.role !== 'club-manager') {
        return res.status(403).send({ message: 'Access forbidden: only club managers can create clubs' });
    }
// set event date number
if (eventInfo.eventDate) {
  eventInfo.eventDate = new Date(eventInfo.eventDate).getTime();
}


    // Set default values
    eventInfo.status = 'Active';
    eventInfo.createdAt = new Date().getTime();
    

    const result = await eventsCollection.insertOne(eventInfo);

    if (result.insertedId) {
        return res.status(201).send({ insertedId: result.insertedId, message: 'Event created successfully' });
    } else {
        return res.status(500).send({ message: 'Failed to create event' });
    }


});
 



// get events 
app.get('/myevents/:email', verifyFBToken, async (req, res) => {

  const email = req.params.email;

  // security check
  if (email !== req.decoded_email) {
    return res.status(403).send({ message: 'forbidden access' });
  }

  const query = { managerEmail: email };

  const myevent = await eventsCollection.find(query).sort({eventDate: -1}).toArray();

  res.send(myevent);
});

      // Send a ping to confirm a successful connection
      // await client.db("admin").command({ ping: 1 });
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