const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client with service role key for admin access
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Mock profile data
const mockProfiles = [
  {
    email: 'alex.chen@example.com',
    profile: {
      display_name: 'Alex Chen',
      age: 28,
      gender: 'non-binary',
      sexual_orientation: 'queer',
      location_city: 'San Francisco',
      location_state: 'CA',
      latitude: 37.7749,
      longitude: -122.4194,
      bio: "Tech enthusiast by day, amateur chef by night. I believe in building a partnership based on mutual respect, shared goals, and separate Netflix accounts. Looking for someone who values authenticity and isn't afraid to be themselves.",
      occupation: 'Software Engineer',
      education: 'UC Berkeley',
      is_verified: true,
      prompt_answers: [
        {
          prompt: "My ideal Sunday looks like",
          answer: "Farmers market in the morning, cooking a new recipe together, then separate hobbies in the afternoon. Balance is everything!"
        },
        {
          prompt: "The partnership I'm looking for",
          answer: "A practical arrangement where we support each other's goals, maintain our independence, and navigate family expectations together."
        },
        {
          prompt: "You should know that I",
          answer: "Value direct communication, need my alone time, and have a slightly concerning obsession with houseplants."
        }
      ]
    },
    photos: [
      'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400',
      'https://images.unsplash.com/photo-1524502397800-2eeaad7c3fe5?w=400',
      'https://images.unsplash.com/photo-1531891570158-e71b35a485bc?w=400'
    ]
  },
  {
    email: 'jordan.williams@example.com',
    profile: {
      display_name: 'Jordan Williams',
      age: 32,
      gender: 'man',
      sexual_orientation: 'gay',
      location_city: 'Los Angeles',
      location_state: 'CA',
      latitude: 34.0522,
      longitude: -118.2437,
      bio: "Documentary filmmaker with a passion for storytelling and social justice. Looking for a partnership that allows us both to thrive professionally while presenting a united front to the world. Let's write our own rules.",
      occupation: 'Documentary Filmmaker',
      education: 'NYU Tisch',
      is_verified: true,
      prompt_answers: [
        {
          prompt: "My non-negotiables are",
          answer: "Mutual respect, financial independence, and someone who understands that my career requires travel and irregular hours."
        },
        {
          prompt: "The best way to win me over is",
          answer: "Show me your passion projects, cook me your comfort food, and be genuinely interested in making the world a little better."
        },
        {
          prompt: "Our life together would include",
          answer: "Supporting each other at work events, hosting dinner parties for chosen family, and being each other's emergency contact."
        }
      ]
    },
    photos: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400'
    ]
  },
  {
    email: 'sam.patel@example.com',
    profile: {
      display_name: 'Sam Patel',
      age: 26,
      gender: 'woman',
      sexual_orientation: 'lesbian',
      location_city: 'Austin',
      location_state: 'TX',
      latitude: 30.2672,
      longitude: -97.7431,
      bio: "Medical resident surviving on coffee and determination. Seeking a practical partnership with someone who understands the demands of a medical career and values building a chosen family. Plus, my parents will finally stop asking questions!",
      occupation: 'Medical Resident',
      education: 'Johns Hopkins Medical',
      is_verified: false,
      prompt_answers: [
        {
          prompt: "My love language is",
          answer: "Acts of service - bringing me coffee during a 24-hour shift is better than any romantic gesture."
        },
        {
          prompt: "I'm looking for someone who",
          answer: "Has their own ambitions, respects boundaries, and can handle medical horror stories over dinner."
        },
        {
          prompt: "Our arrangement would work because",
          answer: "We'd be partners in crime, supporting each other's dreams while keeping our families happy."
        }
      ]
    },
    photos: [
      'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400',
      'https://images.unsplash.com/photo-1582562124811-c09040d0a901?w=400',
      'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=400'
    ]
  },
  {
    email: 'taylor.martinez@example.com',
    profile: {
      display_name: 'Taylor Martinez',
      age: 35,
      gender: 'trans-woman',
      sexual_orientation: 'bisexual',
      location_city: 'Seattle',
      location_state: 'WA',
      latitude: 47.6062,
      longitude: -122.3321,
      bio: "Startup founder building the future of sustainable fashion. Looking for a co-conspirator in this wild journey called life. Someone who gets that love comes in many forms and partnership is about choosing to build something meaningful together.",
      occupation: 'Startup Founder',
      education: 'Stanford MBA',
      is_verified: true,
      prompt_answers: [
        {
          prompt: "Success to me means",
          answer: "Building a company that matters, having a partner who has my back, and proving that unconventional families can thrive."
        },
        {
          prompt: "I need a partner who",
          answer: "Embraces ambition, values chosen family, and won't judge me for working until 2 AM or eating cereal for dinner."
        },
        {
          prompt: "Together we would",
          answer: "Conquer the business world, host legendary holiday parties, and show everyone that modern families come in all forms."
        }
      ]
    },
    photos: [
      'https://images.unsplash.com/photo-1548142813-c348350df52b?w=400',
      'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400',
      'https://images.unsplash.com/photo-1609505848912-b7c3b8b4beda?w=400'
    ]
  },
  {
    email: 'morgan.lee@example.com',
    profile: {
      display_name: 'Morgan Lee',
      age: 30,
      gender: 'man',
      sexual_orientation: 'gay',
      location_city: 'Chicago',
      location_state: 'IL',
      latitude: 41.8781,
      longitude: -87.6298,
      bio: "Investment banker who's tired of the corporate closet. Seeking someone equally ambitious who understands that our arrangement is both practical and revolutionary. Let's secure our futures while living our truths.",
      occupation: 'Investment Banker',
      education: 'Harvard Business',
      is_verified: true,
      prompt_answers: [
        {
          prompt: "My typical weekday",
          answer: "Market opens, coffee, spreadsheets, more coffee, gym, meal prep, and planning world domination from my couch."
        },
        {
          prompt: "I value most",
          answer: "Discretion, ambition, and someone who understands that appearances matter in my industry, unfortunately."
        },
        {
          prompt: "Our partnership would include",
          answer: "Power couple vibes at work events, separate friend groups, shared financial goals, and unwavering mutual support."
        }
      ]
    },
    photos: [
      'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400',
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400',
      'https://images.unsplash.com/photo-1561677843-39dee7a319ca?w=400'
    ]
  }
];

async function addProfileForUser(userData) {
  try {
    // Get user ID by email
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
      console.error('Error listing users:', userError);
      return;
    }

    const user = users.users.find(u => u.email === userData.email);

    if (!user) {
      console.error(`User not found: ${userData.email}`);
      return;
    }

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (existingProfile) {
      console.log(`Profile already exists for ${userData.email}`);

      // Add photos if missing
      const { data: existingPhotos } = await supabase
        .from('photos')
        .select('id')
        .eq('profile_id', existingProfile.id);

      if (!existingPhotos || existingPhotos.length === 0) {
        for (let i = 0; i < userData.photos.length; i++) {
          await supabase
            .from('photos')
            .insert({
              profile_id: existingProfile.id,
              url: userData.photos[i],
              display_order: i,
              is_primary: i === 0,
              is_public: true
            });
        }
        console.log(`Added ${userData.photos.length} photos for ${userData.profile.display_name}`);
      }

      return;
    }

    // Create profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: user.id,
        display_name: userData.profile.display_name,
        age: userData.profile.age,
        gender: userData.profile.gender,
        sexual_orientation: userData.profile.sexual_orientation,
        location_city: userData.profile.location_city,
        location_state: userData.profile.location_state,
        latitude: userData.profile.latitude,
        longitude: userData.profile.longitude,
        bio: userData.profile.bio,
        occupation: userData.profile.occupation,
        education: userData.profile.education,
        is_verified: userData.profile.is_verified,
        prompt_answers: userData.profile.prompt_answers,
        is_active: true
      })
      .select()
      .single();

    if (profileError) {
      console.error(`Error creating profile for ${userData.email}:`, profileError);
      return;
    }

    console.log(`✅ Created profile for: ${userData.profile.display_name}`);

    // Create photos
    for (let i = 0; i < userData.photos.length; i++) {
      const { error: photoError } = await supabase
        .from('photos')
        .insert({
          profile_id: profile.id,
          url: userData.photos[i],
          display_order: i,
          is_primary: i === 0,
          is_public: true
        });

      if (photoError) {
        console.error(`Error creating photo:`, photoError);
      }
    }

    console.log(`Added ${userData.photos.length} photos for ${userData.profile.display_name}`);

    // Create basic preferences
    await supabase
      .from('preferences')
      .insert({
        profile_id: profile.id,
        primary_reason: 'companionship',
        relationship_type: 'platonic',
        wants_children: false,
        housing_preference: 'separate_spaces',
        financial_arrangement: 'separate',
        max_distance_miles: 50,
        willing_to_relocate: false
      });

    console.log(`Created preferences for ${userData.profile.display_name}`);

  } catch (error) {
    console.error(`Unexpected error for ${userData.email}:`, error);
  }
}

async function main() {
  console.log('🚀 Adding profiles for existing users...\n');

  for (const userData of mockProfiles) {
    await addProfileForUser(userData);
  }

  console.log('\n✨ Finished! You should now see profiles in the Discover screen.');
}

main().catch(console.error);