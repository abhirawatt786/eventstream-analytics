const { Kafka } = require("kafkajs");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv");

dotenv.config();

const kafka = new Kafka({
  clientId: "orders-producer",
  brokers: ["localhost:9094"],
});

const producer = kafka.producer();

const TOPIC_NAME = "orders";
const ORDERS_PER_SECOND = 2;

function getRandomProduct() {
  const randomIndex = Math.floor(Math.random() * products.length);
  return products[randomIndex];
}

function getProductsByCategory(category) {
  return products.filter((product) => product.category === category);
}

const products = [
  // Electronics
  {
    id: "ELEC001",
    name: "iPhone 15 Pro",
    category: "Electronics",
    base_price: 999.99,
  },
  {
    id: "ELEC002",
    name: "MacBook Air M2",
    category: "Electronics",
    base_price: 1199.99,
  },
  {
    id: "ELEC003",
    name: "Samsung Galaxy S24",
    category: "Electronics",
    base_price: 799.99,
  },
  {
    id: "ELEC004",
    name: "Sony WH-1000XM5 Headphones",
    category: "Electronics",
    base_price: 399.99,
  },
  {
    id: "ELEC005",
    name: "iPad Pro 11-inch",
    category: "Electronics",
    base_price: 799.99,
  },

  // Clothing
  {
    id: "CLTH001",
    name: "Nike Air Max 270",
    category: "Clothing",
    base_price: 150.0,
  },
  {
    id: "CLTH002",
    name: "Levi's 501 Jeans",
    category: "Clothing",
    base_price: 89.99,
  },
  {
    id: "CLTH003",
    name: "Adidas Ultra Boost",
    category: "Clothing",
    base_price: 180.0,
  },
  {
    id: "CLTH004",
    name: "North Face Jacket",
    category: "Clothing",
    base_price: 199.99,
  },
  {
    id: "CLTH005",
    name: "Ray-Ban Aviator Sunglasses",
    category: "Clothing",
    base_price: 154.99,
  },

  // Books
  {
    id: "BOOK001",
    name: "The Psychology of Money",
    category: "Books",
    base_price: 16.99,
  },
  {
    id: "BOOK002",
    name: "Atomic Habits",
    category: "Books",
    base_price: 18.99,
  },
  {
    id: "BOOK003",
    name: "System Design Interview",
    category: "Books",
    base_price: 39.99,
  },
  { id: "BOOK004", name: "Clean Code", category: "Books", base_price: 42.99 },

  // Home & Garden
  {
    id: "HOME001",
    name: "Dyson V15 Vacuum",
    category: "Home & Garden",
    base_price: 449.99,
  },
  {
    id: "HOME002",
    name: "Instant Pot Duo 7-in-1",
    category: "Home & Garden",
    base_price: 79.99,
  },
  {
    id: "HOME003",
    name: "Philips Hue Smart Bulbs",
    category: "Home & Garden",
    base_price: 49.99,
  },

  // Sports
  {
    id: "SPRT001",
    name: "Peloton Bike+",
    category: "Sports",
    base_price: 2495.0,
  },
  {
    id: "SPRT002",
    name: "Yoga Mat Premium",
    category: "Sports",
    base_price: 89.99,
  },
  {
    id: "SPRT003",
    name: "Dumbbells Set 50lbs",
    category: "Sports",
    base_price: 199.99,
  },
];

function generateOrderEvent() {
  const product = getRandomProduct();

  const basePrice = product.base_price;
  const discount = Math.random() < 0.3 ? Math.random() * 0.2 : 0;
  const tax = 0.08; // 8% tax
  const finalAmount = basePrice * (1 - discount) * (1 + tax);

  const paymentMethods = [
    "credit_card",
    "debit_card",
    "paypal",
    "bank_transfer",
    "apple_pay",
  ];
  const orderStatuses = ["pending", "confirmed", "processing"];
  const locations = [
    "New Delhi",
    "Mumbai",
    "Banglore",
    "Chennai",
    "Kolkata",
    "Ranchi",
  ];

  return {
    order_id: uuidv4(),
    user_id: uuidv4(),
    product: {
      id: product.id,
      name: product.name,
      category: product.category,
      base_price: product.base_price,
    },
    pricing: {
      base_amount: basePrice,
      discount_percent: Math.round(discount * 100),
      tax_percent: 8,
      final_amount: Math.round(finalAmount * 100) / 100,
    },
    order_details: {
      quantity: Math.floor(Math.random() * 3) + 1,
      status: orderStatuses[Math.floor(Math.random() * orderStatuses.length)],
      payment_method:
        paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
      shipping_location:
        locations[Math.floor(Math.random() * locations.length)],
    },
    metadata: {
      timestamp: new Date().toISOString(),
      event_type: "order_created",
      source: "web_app",
      session_id: uuidv4(),
    },
  };
}

async function startOrderProducer() {
  try {
    await producer.connect();
    const topic_name = "orders";
    const events_per_second = 2;
    const interval = 1000 / events_per_second;

    let ordercount = 0;
    const publish = setInterval(async () => {
      try {
        const order = generateOrderEvent();
        ordercount++;
        await producer.send({
          topic: topic_name,
          messages: [
            {
              key: order.user_id,
              value: JSON.stringify(order),
              timestamp: Date.now().toString(),
            },
          ],
        });
        console.log(
          `📦 Order ${ordercount}: ${order.product.name} - $${order.pricing.final_amount} (${order.order_details.status})`
        );
      } catch (err) {
        console.log("failed to publish order", err.message);
      }
    }, interval);
  } catch (err) {
    console.log("producer startup failed", err.message);
  }
}

if (require.main === module) {
  const mode = process.argv[2];

  if (mode === "test") {
    console.log("🧪 Testing Order Generator...\n");
    for (let i = 1; i <= 3; i++) {
      console.log(`--- Sample Order ${i} ---`);
      const order = generateOrderEvent();
      console.log(`${order.product.name} - $${order.pricing.final_amount}`);
    }
  } else {
    startOrderProducer();
  }
}
