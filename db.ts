import mongoose from "mongoose";

export async function connectDB() {
  try {
    const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/solana-bot";
    
    await mongoose.connect(uri);
    
    console.log("✅ Connected to MongoDB");
    
    // Check if db is available before accessing its properties
    if (mongoose.connection.db) {
      console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
    }
    console.log(`🔗 Host: ${mongoose.connection.host}`);
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
}

// Handle connection events
mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err);
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});