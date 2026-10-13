# E-Commerce Customer Behavior & Sales Analysis (Turkey)

Interactive D3.js dashboard that visualizes e-commerce customer behavior and sales
across Turkey's regions and cities. Built with vanilla JavaScript and D3 v7 — no
build step, no dependencies to install, just open it in a browser.

## Features

- **Choropleth map of Turkey** — total sales, order count, and average session
  duration per city, each with its own color scale and legend.
- **Age group × product category heatmap** — spending broken down by customer
  age bracket and product category.
- **Discount vs. spending scatter plot** — relationship between discount amount
  and total amount spent.
- **Sales trend line chart with brushing** — select a date range on the chart
  to filter every other chart on the page.
- **Region comparison bar chart** — total sales by region, sorted and animated.
- **Filters** — region, device type (Mobile/Desktop/Tablet), and payment method
  (Credit Card/Cash on Delivery), plus click-to-filter by city on the map.

All charts are linked: changing a filter or clicking a city/region updates every
visualization on the page at once.

## Tech stack

- [D3.js v7](https://d3js.org/) (loaded via CDN)
- Plain HTML/CSS/JavaScript — no framework, no bundler

## Data

- `ecommerce_customer_behavior_dataset.csv` — order-level transaction data
  (order ID, customer ID, date, age, gender, city, product category, price,
  quantity, discount, total amount, payment method, device type, session
  duration, pages viewed, returning customer flag, delivery time, rating).
- `turkey_geo.json` — GeoJSON boundaries for Turkish cities used to render the
  choropleth map.

## Running it locally

Because the app loads the CSV and GeoJSON files via `fetch`, you need to serve
the folder over HTTP rather than opening `index.html` directly from disk.

```bash
# from the project folder
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Project structure

```
.
├── index.html    # page layout and chart containers
├── app.js        # data loading, filtering, and all D3 chart rendering logic
├── style.css     # styling
├── ecommerce_customer_behavior_dataset.csv
└── turkey_geo.json
```
