import React, { useState, useEffect } from "react";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { useLocation } from "react-router-dom";
import "./ItineraryPage.css";
import { Link } from "react-router-dom";
import logo from '../assets/logo2.png';

const ItineraryPage = () => {
  const location = useLocation();
  const tempData = location.state?.itinerary;
  const destination = location.state?.destination;
  const checkIn = location.state?.checkIn;
  const checkOut = location.state?.checkOut;

  if (!tempData) {
    return <p>No itinerary data available</p>;
  }


  const [hotels, setHotels] = useState([]);
  const [loadingHotels, setLoadingHotels] = useState(false);
  const [cart, setCart] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [editModal, setEditModal] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [itineraryData, setItineraryData] = useState(() => JSON.parse(tempData));
  const { title, days, flights, weather } = itineraryData;
  console.log(itineraryData);
  
  // Handle Edit Modal
  const handleEditSubmit = async () => {
    setLoadingEdit(true);

    try {
      const response = await fetch("http://localhost:5000/get_gemini_response", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: `you gave the following response: ${itineraryData}, the following additions are needed to the existing response: ${editPrompt}, 
                    give the updated response in the following format:
                    ### Response Format:
                    Respond as a *valid JSON object* with this exact schema:

                    {
                    "title": "Trip Title, purpose of visit and type of group",
                    "days": [
                        {
                        "day": 1,
                        "activities": [
                            {
                            "time": "9:00 AM",
                            "activity": "Visit Eiffel Tower",
                            "details": "Tickets included; duration 2 hours."
                            },
                            ...
                        ]
                        },
                        ...
                    ],
                    "flights": [
                        {
                        "airline": "Airline Name",
                        "flightNumber": "Flight Number",
                        "departure": "YYYY-MM-DDTHH:mm",
                        "arrival": "YYYY-MM-DDTHH:mm",
                        "price": in INR,
                        "details": "Non-stop; 2 checked bags included."
                        },
                        ...
                    ], 
                    "weather": {
                        "avgTemp": Average Temperature.
                        "condition": Condition (e.g., sunny, cloudy, etc.).
                        "sunExposure": Sun Exposure (e.g., high, moderate, low).
                        "rainChance": Rain Probability (percentage chance of rain).
                        "wind": Wind Speed (in km/h).
                        "humidity": Humidity (percentage).
                        "uvIndex": UV Index.
                        "packingTips": Packing Tips (suggestions based on the weather).
                        }
                    }

                    ### Notes:
                    - If data for any field is unavailable, return an empty array for that field.
                    - Ensure the response adheres strictly to the JSON format without additional text or invalid keys.
                    - Validate the response before sending.`
        }),
      });

      const responseData = await response.json();
      const newData = responseData.response;
      
      // Check if newData is a string
      if (typeof newData === 'string') {
          try {
              const finalData = JSON.parse(newData);
              console.log(finalData);  // This should now be an object
          } catch (error) {
              console.error("Error parsing JSON:", error);
          }
      } else {
          console.log("Already an object:", newData);
      }
      
    
        setItineraryData(newData);
      setEditModal(false);
    } catch (error) {
      console.error("Error updating itinerary:", error);
    } finally {
      setLoadingEdit(false);
    }
  };

  // Fetch GeoId
  const fetchGeoId = async (place) => {
    const urlGeoId = `https://tripadvisor-com1.p.rapidapi.com/auto-complete?query=${place}`;
    const optionsGeoId = {
      method: 'GET',
      headers: {
        'x-rapidapi-key': '1786cdd64amsh13b957631cdacbep1a686ajsn52eef2f02006',
        'x-rapidapi-host': 'tripadvisor-com1.p.rapidapi.com',
      },
    };

    try {
      const response = await fetch(urlGeoId, optionsGeoId);
      const result = await response.json();
      return result.data[0]?.geoId || null;
    } catch (error) {
      console.error('Error fetching geoId:', error);
      return null;
    }
  };

  // add to cart
  const addToCart = (item) => {
    const alreadyInCart = cart.some((cartItem) => cartItem.name === item.name);

    if (alreadyInCart) {
      setCart(cart.filter((cartItem) => cartItem.name !== item.name));
      if (item.type === 'hotel') {
        setSelectedHotel(null);
      }
    } else {
      if (item.type === 'hotel') {
        setSelectedHotel(item.name);
        setCart((prevCart) => [...prevCart.filter((cartItem) => cartItem.type !== 'hotel'), item]);
      } else {
        setCart((prevCart) => [...prevCart, item]);
      }
    }
  };

  // calculate total 
  const calculateTotal = () => {
    return cart.reduce((total, item) => total + item.price, 0);
  };

  // Fetch Hotels
  const fetchHotels = async (place) => {
    setLoadingHotels(true);
    const geoId = await fetchGeoId(place);

    if (!geoId) {
      console.log('Could not fetch geoId.');
      setHotels([]);
      setLoadingHotels(false);
      return;
    }

    const url = `https://tripadvisor-com1.p.rapidapi.com/hotels/search?geoId=${geoId}&checkIn=${checkIn}&checkOut=${checkOut}&rooms=1&adults=2`;
    const options = {
      method: 'GET',
      headers: {
        'x-rapidapi-key': '1786cdd64amsh13b957631cdacbep1a686ajsn52eef2f02006',
        'x-rapidapi-host': 'tripadvisor-com1.p.rapidapi.com',
      },
    };

    try {
      const response = await fetch(url, options);
      const result = await response.json();
      console.log(result);
      const extractedHotels = (result?.data?.hotels || []).slice(0, 6).map((hotel) => {
        const photoTemplate = hotel.cardPhotos?.[0]?.sizes?.urlTemplate;
        const photoUrl = photoTemplate ? photoTemplate.replace('{width}', 200).replace('{height}', 200) : 'https://via.placeholder.com/400x300';
        const usdPrice = hotel.commerceInfo?.priceForDisplay?.string || "N/A";
        const price = parseFloat(usdPrice.replace(/[^0-9.]/g, ""));  // Extract numeric value
        const inrPrice = price * 85;  // Convert to INR
        const numStars = hotel.bubbleRating.rating;
        return {
          name: hotel.cardTitle?.string || 'N/A',
          price: inrPrice,
          details: hotel.descriptiveText || 'No description available.',
          image: photoUrl,
          numStars: numStars
        };
      });

      setHotels(extractedHotels);
      console.log(extractedHotels);
    } catch (error) {
      console.error('Error fetching hotels:', error);
      setHotels([]);
    } finally {
      setLoadingHotels(false);
    }
  };

  // Fetch hotels on component mount
  useEffect(() => {
    fetchHotels(destination);
  }, []);

  // Slider settings for react-slick
  const sliderSettings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    centerMode: true,
    centerPadding: "40px",
    responsive: [
      {
        breakpoint: 768,
        settings: {
          centerPadding: "20px",
        },
      },
    ],
  };

  return (
    <div className="itinerary-page">
      <header className="navbar">
        <div className="logo">
          <img src={logo} alt="Travel AI Logo" />
          <h1>Travel AI</h1>
        </div>
        <nav>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/login">Login</Link></li>
          </ul>
        </nav>
      </header>

      <aside className="sidebar">
  <nav>
    <ul>
      <li><button onClick={() => document.getElementById('itinerary').scrollIntoView({ behavior: 'smooth' })}>Itinerary</button></li>
      <li><button onClick={() => document.getElementById('weather').scrollIntoView({ behavior: 'smooth' })}>Weather</button></li>
      <li><button onClick={() => document.getElementById('flights').scrollIntoView({ behavior: 'smooth' })}>Flights</button></li>
      <li><button onClick={() => document.getElementById('hotels').scrollIntoView({ behavior: 'smooth' })}>Hotels</button></li>
      <li><button onClick={() => setShowModal(true)}>Cart ({cart.length})</button></li>
      <li><button onClick={() => setEditModal(true)}>Edit Plan</button></li>
      </ul>
  </nav>
</aside>


      <main className="main-content">
        <section id="itinerary">
          <h2>{title}</h2>

          <h3>Daily Activities</h3><br/><br/>
          <Slider {...sliderSettings}>
            {days.map((day, index) => (
              <div key={index} className="day-card">
                <h3>Day {day.day}</h3>
                <ul>
                  {day.activities.map((activity, idx) => (
                    <li key={idx} className="activity-item">
                      <strong>{activity.time}</strong> - {activity.activity}
                      <p>{activity.details}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Slider>
        </section><br/><br/><br/>
        <section id="weather"><br/><br/><br/>
          <h3>Weather Forecast & Packing Tips during your trip</h3>
          <div className="day-section">
            <p className="activity-item"><strong>Average Temperature:</strong> {weather?.avgTemp || 'N/A'}</p>
            <p className="activity-item"><strong>Condition:</strong> {weather?.condition || 'N/A'}</p>
            <p className="activity-item"><strong>Sun Exposure:</strong> {weather?.sunExposure || 'Moderate'}</p>
            <p className="activity-item"><strong>Rain Probability:</strong> {weather?.rainChance || 'N/A'}</p>
            <p className="activity-item"><strong>Wind:</strong> {weather?.wind || 'N/A'}</p>
            <p className="activity-item"><strong>Humidity:</strong> {weather?.humidity || 'N/A'}</p>
            <p className="activity-item"><strong>UV INDEX:</strong> {weather?.uvIndex || 'N/A'}%</p>
            <p className="activity-item"><strong>Packing Tips:</strong> {weather?.packingTips || 'Pack light, bring sunscreen and a hat.'}</p>
          </div>
        </section>
        <section id="flights"><br/><br/><br/>
          <h3>Flight Details</h3>
          {flights.length > 0 ? (
            flights.map((flight, index) => (
              <div key={index} className="flight-section">
                <h4><strong>{flight.airline}</strong> - Flight {flight.flightNumber}</h4>
                <p>Departure: {flight.departure}</p>
                <p>Arrival: {flight.arrival}</p>
                <p>Price: {flight.price}</p>
                <p>{flight.details}</p>
                <button className="add-to-cart-btn" onClick={() => addToCart(flight)}>Add to Cart</button>
                </div>
            ))
          ) : (
            <p>No flights available</p>
          )}
        </section>
        <section id="hotels"><br/><br/><br/>
          <h3>Hotel Details</h3>
          {loadingHotels ? (
            <p>Loading hotels...</p>
          ) : hotels.length > 0 ? (
            <div className="hotel-cards-container">
            {hotels.map((hotel, index) => {
                const renderStars = (numStars) => {
                const maxStars = 5;
                const fullStars = Math.floor(numStars);
                const halfStar = numStars % 1 !== 0;
                let stars = '';

                for (let i = 0; i < fullStars; i++) {
                    stars += '★';
                }

                if (halfStar) {
                    stars += '⯨';
                }

                for (let i = fullStars + (halfStar ? 1 : 0); i < maxStars; i++) {
                    stars += '☆';
                }

                return stars;
                };

                return (
                <div key={index} className="hotel-card">
                    <img
                    src={hotel.image}
                    alt={`Image of ${hotel.name}`}
                    className="hotel-image"
                    />
                    <div className="hotel-content">
                    <h4 className="hotel-title">{hotel.name}</h4>
                    <p className="hotel-description">{hotel.details}</p>
                    <p className="hotel-price">
                        Price: ₹ <span>{hotel.price}</span> / night
                    </p>
                    <p>Rating: {renderStars(hotel.numStars)}</p>
                    <button className="add-to-cart-btn"
                    onClick={() => addToCart(hotel)}
                    disabled={selectedHotel && selectedHotel !== hotel.name}
                  >
                    {selectedHotel === hotel.name ? 'Remove from Cart' : 'Add to Cart'}
                  </button>                    
                  </div>
                </div>
                );
            })}
            </div>
          ) : (
            <p>No hotel details available.</p>
          )}
        </section>
      </main>
      {/* Modal */}
      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>Your Cart</h2>
            {cart.length > 0 ? (
              <div>
                {cart.map((item, idx) => (
                  <div key={idx} className="cart-item">
                    <p>{item.name} - ₹{item.price}</p>
                  </div>
                ))}
                <hr />
                <h3>Total: ₹{calculateTotal()}</h3>
              </div>
            ) : (
              <p>Your cart is empty</p>
            )}
            <button onClick={() => setShowModal(false)}>Close</button>
          </div>
        </div>
      )}
      {/* Edit Plan Modal */}
      {editModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>Edit Your Plan</h2>
            <textarea
              placeholder="Enter your modifications..."
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              rows="5"
            ></textarea>
            <div className="modal-actions">
              <button onClick={handleEditSubmit} disabled={loadingEdit}>
                {loadingEdit ? "Updating..." : "Update Plan"}
              </button>
              <button onClick={() => setEditModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItineraryPage;
