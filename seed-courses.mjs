import { drizzle } from 'drizzle-orm/mysql2';
import { courses } from './drizzle/schema.js';

const db = drizzle(process.env.DATABASE_URL);

const sampleCourses = [
  {
    title: 'Introduction to AI & Machine Learning',
    description: 'Learn the fundamentals of artificial intelligence and machine learning. Perfect for beginners who want to understand how AI works and build their first models.',
    price: '99.00',
    currency: 'USD',
    imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&auto=format&fit=crop',
    duration: '8 weeks',
    level: 'beginner',
    isActive: true,
  },
  {
    title: 'Advanced Deep Learning with PyTorch',
    description: 'Master deep learning architectures including CNNs, RNNs, and Transformers. Build production-ready models with PyTorch.',
    price: '199.00',
    currency: 'USD',
    imageUrl: 'https://images.unsplash.com/photo-1555255707-c07966088b7b?w=800&auto=format&fit=crop',
    duration: '12 weeks',
    level: 'advanced',
    isActive: true,
  },
  {
    title: 'Natural Language Processing Fundamentals',
    description: 'Explore the world of NLP, from text preprocessing to building chatbots and sentiment analysis systems.',
    price: '149.00',
    currency: 'USD',
    imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop',
    duration: '10 weeks',
    level: 'intermediate',
    isActive: true,
  },
  {
    title: 'Computer Vision with OpenCV',
    description: 'Learn image processing, object detection, and facial recognition using OpenCV and modern computer vision techniques.',
    price: '179.00',
    currency: 'USD',
    imageUrl: 'https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=800&auto=format&fit=crop',
    duration: '10 weeks',
    level: 'intermediate',
    isActive: true,
  },
  {
    title: 'AI Ethics & Responsible AI Development',
    description: 'Understand the ethical implications of AI, bias in machine learning, and how to build responsible AI systems.',
    price: '79.00',
    currency: 'USD',
    imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop',
    duration: '4 weeks',
    level: 'beginner',
    isActive: true,
  },
  {
    title: 'Building AI-Powered Applications',
    description: 'Learn to integrate AI models into real-world applications. Deploy ML models to production with best practices.',
    price: '159.00',
    currency: 'USD',
    imageUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&auto=format&fit=crop',
    duration: '8 weeks',
    level: 'intermediate',
    isActive: true,
  },
];

async function seedCourses() {
  try {
    console.log('🌱 Seeding courses...');
    
    for (const course of sampleCourses) {
      await db.insert(courses).values(course);
      console.log(`✅ Created course: ${course.title}`);
    }
    
    console.log('✨ Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding courses:', error);
    process.exit(1);
  }
}

seedCourses();
