--
-- PostgreSQL database dump
--

\restrict lV2hd68saIeFZME0dDoowDrs5AFy8QYcO1YyK4HDCutSUgfArv6FSE1M559QOjQ

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;


--
-- Name: EXTENSION unaccent; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION unaccent IS 'text search dictionary that removes accents';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: CouponType; Type: TYPE; Schema: public; Owner: divinittys
--

CREATE TYPE public."CouponType" AS ENUM (
    'PERCENTAGE',
    'FIXED_AMOUNT',
    'FREE_SHIPPING'
);


ALTER TYPE public."CouponType" OWNER TO divinittys;

--
-- Name: OrderStatus; Type: TYPE; Schema: public; Owner: divinittys
--

CREATE TYPE public."OrderStatus" AS ENUM (
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'REFUNDED'
);


ALTER TYPE public."OrderStatus" OWNER TO divinittys;

--
-- Name: PaymentProvider; Type: TYPE; Schema: public; Owner: divinittys
--

CREATE TYPE public."PaymentProvider" AS ENUM (
    'WEBPAY',
    'MERCADOPAGO',
    'TRANSFER',
    'CASH'
);


ALTER TYPE public."PaymentProvider" OWNER TO divinittys;

--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: divinittys
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'PAID',
    'FAILED',
    'REFUNDED',
    'CANCELLED'
);


ALTER TYPE public."PaymentStatus" OWNER TO divinittys;

--
-- Name: ReviewStatus; Type: TYPE; Schema: public; Owner: divinittys
--

CREATE TYPE public."ReviewStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE public."ReviewStatus" OWNER TO divinittys;

--
-- Name: Role; Type: TYPE; Schema: public; Owner: divinittys
--

CREATE TYPE public."Role" AS ENUM (
    'SUPER_ADMIN',
    'ADMIN',
    'CUSTOMER'
);


ALTER TYPE public."Role" OWNER TO divinittys;

--
-- Name: ShippingStatus; Type: TYPE; Schema: public; Owner: divinittys
--

CREATE TYPE public."ShippingStatus" AS ENUM (
    'PENDING',
    'READY_TO_SHIP',
    'IN_TRANSIT',
    'DELIVERED',
    'RETURNED',
    'FAILED'
);


ALTER TYPE public."ShippingStatus" OWNER TO divinittys;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: divinittys
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO divinittys;

--
-- Name: addresses; Type: TABLE; Schema: public; Owner: divinittys
--

CREATE TABLE public.addresses (
    id text NOT NULL,
    "userId" text NOT NULL,
    label text DEFAULT 'Casa'::text NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    street text NOT NULL,
    number text NOT NULL,
    apartment text,
    commune text NOT NULL,
    city text NOT NULL,
    region text NOT NULL,
    "postalCode" text,
    phone text,
    "isDefault" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.addresses OWNER TO divinittys;

--
-- Name: brands; Type: TABLE; Schema: public; Owner: divinittys
--

CREATE TABLE public.brands (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    logo text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.brands OWNER TO divinittys;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: divinittys
--

CREATE TABLE public.categories (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    image text,
    "parentId" text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.categories OWNER TO divinittys;

--
-- Name: coupons; Type: TABLE; Schema: public; Owner: divinittys
--

CREATE TABLE public.coupons (
    id text NOT NULL,
    code text NOT NULL,
    type public."CouponType" NOT NULL,
    value numeric(10,2) NOT NULL,
    "minOrderAmount" numeric(10,2),
    "maxUses" integer,
    "usedCount" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "expiresAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.coupons OWNER TO divinittys;

--
-- Name: hair_profiles; Type: TABLE; Schema: public; Owner: divinittys
--

CREATE TABLE public.hair_profiles (
    id text NOT NULL,
    "userId" text NOT NULL,
    "hairType" text,
    "hairTexture" text,
    "hairCondition" text,
    "currentColor" text,
    "desiredTreatment" text[],
    concerns text[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.hair_profiles OWNER TO divinittys;

--
-- Name: inventory; Type: TABLE; Schema: public; Owner: divinittys
--

CREATE TABLE public.inventory (
    id text NOT NULL,
    "productId" text NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    "reservedStock" integer DEFAULT 0 NOT NULL,
    "lowStockThreshold" integer DEFAULT 5 NOT NULL,
    "trackStock" boolean DEFAULT true NOT NULL,
    "allowBackorder" boolean DEFAULT false NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.inventory OWNER TO divinittys;

--
-- Name: order_items; Type: TABLE; Schema: public; Owner: divinittys
--

CREATE TABLE public.order_items (
    id text NOT NULL,
    "orderId" text NOT NULL,
    "productId" text NOT NULL,
    "variantId" text,
    sku text NOT NULL,
    name text NOT NULL,
    image text,
    price numeric(10,2) NOT NULL,
    quantity integer NOT NULL,
    total numeric(10,2) NOT NULL
);


ALTER TABLE public.order_items OWNER TO divinittys;

--
-- Name: orders; Type: TABLE; Schema: public; Owner: divinittys
--

CREATE TABLE public.orders (
    id text NOT NULL,
    "orderNumber" text NOT NULL,
    "userId" text,
    "addressId" text,
    status public."OrderStatus" DEFAULT 'PENDING'::public."OrderStatus" NOT NULL,
    "paymentStatus" public."PaymentStatus" DEFAULT 'PENDING'::public."PaymentStatus" NOT NULL,
    "shippingStatus" public."ShippingStatus" DEFAULT 'PENDING'::public."ShippingStatus" NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    "discountAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    "shippingAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    "taxAmount" numeric(10,2) DEFAULT 0 NOT NULL,
    total numeric(10,2) NOT NULL,
    "guestEmail" text,
    "guestName" text,
    "guestPhone" text,
    "shippingData" jsonb,
    notes text,
    "couponCode" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.orders OWNER TO divinittys;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: divinittys
--

CREATE TABLE public.payments (
    id text NOT NULL,
    "orderId" text NOT NULL,
    provider public."PaymentProvider" NOT NULL,
    status public."PaymentStatus" DEFAULT 'PENDING'::public."PaymentStatus" NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'CLP'::text NOT NULL,
    "externalId" text,
    token text,
    "authCode" text,
    installments integer DEFAULT 1 NOT NULL,
    "paymentMethod" text,
    "responseData" jsonb,
    "errorMessage" text,
    "paidAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.payments OWNER TO divinittys;

--
-- Name: product_attributes; Type: TABLE; Schema: public; Owner: divinittys
--

CREATE TABLE public.product_attributes (
    id text NOT NULL,
    "productId" text NOT NULL,
    name text NOT NULL,
    value text NOT NULL
);


ALTER TABLE public.product_attributes OWNER TO divinittys;

--
-- Name: product_images; Type: TABLE; Schema: public; Owner: divinittys
--

CREATE TABLE public.product_images (
    id text NOT NULL,
    "productId" text NOT NULL,
    url text NOT NULL,
    alt text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isMain" boolean DEFAULT false NOT NULL
);


ALTER TABLE public.product_images OWNER TO divinittys;

--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: divinittys
--

CREATE TABLE public.product_variants (
    id text NOT NULL,
    "productId" text NOT NULL,
    sku text NOT NULL,
    name text NOT NULL,
    price numeric(10,2) NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    image text,
    options jsonb,
    "isActive" boolean DEFAULT true NOT NULL
);


ALTER TABLE public.product_variants OWNER TO divinittys;

--
-- Name: products; Type: TABLE; Schema: public; Owner: divinittys
--

CREATE TABLE public.products (
    id text NOT NULL,
    sku text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    "shortDescription" text,
    "categoryId" text NOT NULL,
    "brandId" text,
    "basePrice" numeric(10,2) NOT NULL,
    "comparePrice" numeric(10,2),
    "costPrice" numeric(10,2),
    "isActive" boolean DEFAULT true NOT NULL,
    "isFeatured" boolean DEFAULT false NOT NULL,
    "isOnSale" boolean DEFAULT false NOT NULL,
    tags text[],
    weight numeric(8,3),
    dimensions jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "imageUrl" text,
    "vendorId" text
);


ALTER TABLE public.products OWNER TO divinittys;

--
-- Name: promotions; Type: TABLE; Schema: public; Owner: divinittys
--

CREATE TABLE public.promotions (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    type text NOT NULL,
    "imageUrl" text,
    "linkUrl" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "startsAt" timestamp(3) without time zone,
    "endsAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.promotions OWNER TO divinittys;

--
-- Name: reviews; Type: TABLE; Schema: public; Owner: divinittys
--

CREATE TABLE public.reviews (
    id text NOT NULL,
    "productId" text NOT NULL,
    "userId" text NOT NULL,
    rating integer NOT NULL,
    title text,
    body text,
    status public."ReviewStatus" DEFAULT 'PENDING'::public."ReviewStatus" NOT NULL,
    "isVerified" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.reviews OWNER TO divinittys;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: divinittys
--

CREATE TABLE public.sessions (
    id text NOT NULL,
    "userId" text NOT NULL,
    "refreshToken" text NOT NULL,
    "userAgent" text,
    "ipAddress" text,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.sessions OWNER TO divinittys;

--
-- Name: settings; Type: TABLE; Schema: public; Owner: divinittys
--

CREATE TABLE public.settings (
    id text NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    type text DEFAULT 'string'::text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.settings OWNER TO divinittys;

--
-- Name: shipment_events; Type: TABLE; Schema: public; Owner: divinittys
--

CREATE TABLE public.shipment_events (
    id text NOT NULL,
    "shipmentId" text NOT NULL,
    status text NOT NULL,
    description text NOT NULL,
    location text,
    "timestamp" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.shipment_events OWNER TO divinittys;

--
-- Name: shipments; Type: TABLE; Schema: public; Owner: divinittys
--

CREATE TABLE public.shipments (
    id text NOT NULL,
    "orderId" text NOT NULL,
    carrier text DEFAULT 'BLUEXPRESS'::text NOT NULL,
    "trackingNumber" text,
    "trackingUrl" text,
    "labelUrl" text,
    status public."ShippingStatus" DEFAULT 'PENDING'::public."ShippingStatus" NOT NULL,
    "estimatedDays" integer,
    "shippingCost" numeric(10,2),
    "packageWeight" numeric(8,3),
    "packageDimensions" jsonb,
    "originData" jsonb,
    "destinationData" jsonb,
    "externalData" jsonb,
    "shippedAt" timestamp(3) without time zone,
    "deliveredAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.shipments OWNER TO divinittys;

--
-- Name: subscribers; Type: TABLE; Schema: public; Owner: divinittys
--

CREATE TABLE public.subscribers (
    id text NOT NULL,
    email text NOT NULL,
    name text,
    "isActive" boolean DEFAULT true NOT NULL,
    source text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.subscribers OWNER TO divinittys;

--
-- Name: users; Type: TABLE; Schema: public; Owner: divinittys
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    "emailVerified" timestamp(3) without time zone,
    name text,
    phone text,
    "passwordHash" text NOT NULL,
    role public."Role" DEFAULT 'CUSTOMER'::public."Role" NOT NULL,
    avatar text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.users OWNER TO divinittys;

--
-- Name: vendor_payouts; Type: TABLE; Schema: public; Owner: divinittys
--

CREATE TABLE public.vendor_payouts (
    id text NOT NULL,
    "vendorId" text NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'CLP'::text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    reference text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "paidAt" timestamp(3) without time zone
);


ALTER TABLE public.vendor_payouts OWNER TO divinittys;

--
-- Name: vendors; Type: TABLE; Schema: public; Owner: divinittys
--

CREATE TABLE public.vendors (
    id text NOT NULL,
    "userId" text NOT NULL,
    "shopName" text NOT NULL,
    slug text NOT NULL,
    description text,
    logo text,
    "isActive" boolean DEFAULT true NOT NULL,
    commission numeric(4,2) DEFAULT 0.15 NOT NULL,
    "bankAccount" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.vendors OWNER TO divinittys;

--
-- Name: wishlist_items; Type: TABLE; Schema: public; Owner: divinittys
--

CREATE TABLE public.wishlist_items (
    id text NOT NULL,
    "userId" text NOT NULL,
    "productId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.wishlist_items OWNER TO divinittys;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: divinittys
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
98ba865c-ed18-44c8-ac7f-fddbe1a4f3e4	bfd386024a3fc8a5afb2ca4fc2fcfef96177e67c01c8438b284296bf6c1b5961	2026-08-09 12:32:26.315942+00	0_init	\N	\N	2026-08-09 12:32:26.197642+00	1
cebd3c9f-a741-4804-89eb-f906cba7949a	23b8cb9d550e762706e3ab04c62a93b403b2d610833ff3afa1192170bfc70e73	2026-08-09 12:32:26.31919+00	20260325_add_image_url	\N	\N	2026-08-09 12:32:26.316563+00	1
6ac00d94-ae5b-45c1-ab22-77eb56f36c14	b23a24f2a8b3799cadb04e4c5212c45d31e5f45d3760be944d149f9081d773a6	2026-08-09 12:32:26.349238+00	20260329_add_vendor_subscriber_promotion	\N	\N	2026-08-09 12:32:26.320245+00	1
f1b4617d-6b4e-4ae7-9b89-b408d878943a	7ca0a2dea54e8c90912f95ca4e6495932051606c89594645d16eefee7162baed	2026-08-09 12:32:26.355382+00	20260803160433_init	\N	\N	2026-08-09 12:32:26.349902+00	1
\.


--
-- Data for Name: addresses; Type: TABLE DATA; Schema: public; Owner: divinittys
--

COPY public.addresses (id, "userId", label, "firstName", "lastName", street, number, apartment, commune, city, region, "postalCode", phone, "isDefault", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: brands; Type: TABLE DATA; Schema: public; Owner: divinittys
--

COPY public.brands (id, name, slug, logo, "isActive", "createdAt") FROM stdin;
cmslxli8g000aou6nedusimms	Wella	wella	\N	t	2026-08-09 15:02:15.952
cmslxli8i000bou6n4t1c2our	Loreal	loreal	\N	t	2026-08-09 15:02:15.954
cmslxli8j000cou6n7stffvu4	Kerastase	kerastase	\N	t	2026-08-09 15:02:15.956
cmslxli8k000dou6njdujkxq5	Schwarzkopf	schwarzkopf	\N	t	2026-08-09 15:02:15.957
cmslxli8m000eou6n2teuiwy6	Redken	redken	\N	t	2026-08-09 15:02:15.958
cmslxli8n000fou6nh8ak0wks	Matrix	matrix	\N	t	2026-08-09 15:02:15.959
cmslxli8o000gou6nivuoaymq	Joico	joico	\N	t	2026-08-09 15:02:15.96
cmslxli8p000hou6nizkh9am2	Revlon	revlon	\N	t	2026-08-09 15:02:15.961
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: divinittys
--

COPY public.categories (id, name, slug, description, image, "parentId", "sortOrder", "isActive", "createdAt", "updatedAt") FROM stdin;
cmslxli7x0001ou6nl606w9u7	Cuidado Capilar	cuidado-capilar	\N	\N	\N	1	t	2026-08-09 15:02:15.934	2026-08-09 15:02:15.934
cmslxli800002ou6nsj8h1j69	Coloración	coloracion	\N	\N	\N	2	t	2026-08-09 15:02:15.937	2026-08-09 15:02:15.937
cmslxli820003ou6nd29e1uq8	Tratamientos	tratamientos	\N	\N	\N	3	t	2026-08-09 15:02:15.938	2026-08-09 15:02:15.938
cmslxli840004ou6nkhagl4jp	Styling	styling	\N	\N	\N	4	t	2026-08-09 15:02:15.94	2026-08-09 15:02:15.94
cmslxli860005ou6nytt7pque	Keratina	keratina	\N	\N	\N	5	t	2026-08-09 15:02:15.943	2026-08-09 15:02:15.943
cmslxli880006ou6n2y3ivjoo	Maquillaje	maquillaje	\N	\N	\N	6	t	2026-08-09 15:02:15.944	2026-08-09 15:02:15.944
cmslxli8a0007ou6nr2250n53	Skincare	skincare	\N	\N	\N	7	t	2026-08-09 15:02:15.946	2026-08-09 15:02:15.946
cmslxli8c0008ou6nmljelts8	Herramientas	herramientas	\N	\N	\N	8	t	2026-08-09 15:02:15.948	2026-08-09 15:02:15.948
cmslxli8d0009ou6nt66p9an9	Accesorios	accesorios	\N	\N	\N	9	t	2026-08-09 15:02:15.95	2026-08-09 15:02:15.95
\.


--
-- Data for Name: coupons; Type: TABLE DATA; Schema: public; Owner: divinittys
--

COPY public.coupons (id, code, type, value, "minOrderAmount", "maxUses", "usedCount", "isActive", "expiresAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: hair_profiles; Type: TABLE DATA; Schema: public; Owner: divinittys
--

COPY public.hair_profiles (id, "userId", "hairType", "hairTexture", "hairCondition", "currentColor", "desiredTreatment", concerns, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: inventory; Type: TABLE DATA; Schema: public; Owner: divinittys
--

COPY public.inventory (id, "productId", stock, "reservedStock", "lowStockThreshold", "trackStock", "allowBackorder", "updatedAt") FROM stdin;
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: divinittys
--

COPY public.order_items (id, "orderId", "productId", "variantId", sku, name, image, price, quantity, total) FROM stdin;
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: divinittys
--

COPY public.orders (id, "orderNumber", "userId", "addressId", status, "paymentStatus", "shippingStatus", subtotal, "discountAmount", "shippingAmount", "taxAmount", total, "guestEmail", "guestName", "guestPhone", "shippingData", notes, "couponCode", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: divinittys
--

COPY public.payments (id, "orderId", provider, status, amount, currency, "externalId", token, "authCode", installments, "paymentMethod", "responseData", "errorMessage", "paidAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: product_attributes; Type: TABLE DATA; Schema: public; Owner: divinittys
--

COPY public.product_attributes (id, "productId", name, value) FROM stdin;
\.


--
-- Data for Name: product_images; Type: TABLE DATA; Schema: public; Owner: divinittys
--

COPY public.product_images (id, "productId", url, alt, "sortOrder", "isMain") FROM stdin;
\.


--
-- Data for Name: product_variants; Type: TABLE DATA; Schema: public; Owner: divinittys
--

COPY public.product_variants (id, "productId", sku, name, price, stock, image, options, "isActive") FROM stdin;
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: divinittys
--

COPY public.products (id, sku, name, slug, description, "shortDescription", "categoryId", "brandId", "basePrice", "comparePrice", "costPrice", "isActive", "isFeatured", "isOnSale", tags, weight, dimensions, "createdAt", "updatedAt", "imageUrl", "vendorId") FROM stdin;
\.


--
-- Data for Name: promotions; Type: TABLE DATA; Schema: public; Owner: divinittys
--

COPY public.promotions (id, title, description, type, "imageUrl", "linkUrl", "isActive", "startsAt", "endsAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: reviews; Type: TABLE DATA; Schema: public; Owner: divinittys
--

COPY public.reviews (id, "productId", "userId", rating, title, body, status, "isVerified", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: divinittys
--

COPY public.sessions (id, "userId", "refreshToken", "userAgent", "ipAddress", "expiresAt", "createdAt") FROM stdin;
cmsmnuzgk0001s001m1vh07ic	cmslxli7r0000ou6nqs72dgrb	eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJjbXNseGxpN3IwMDAwb3U2bnFzNzJkZ3JiIiwiZW1haWwiOiJhZG1pbkBkaXZpbml0dHlzLmNsIiwicm9sZSI6IlNVUEVSX0FETUlOIiwiaWF0IjoxNzg2MzMxODQ4LCJleHAiOjE3ODg5MjM4NDh9.5_ISsiIR-jRh9rM-4He7w8_gaN2PvaNN24IYMoe9yz0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	201.241.22.19	2026-09-09 03:17:28.196	2026-08-10 03:17:28.197
\.


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: divinittys
--

COPY public.settings (id, key, value, type, "updatedAt") FROM stdin;
cmslxli8r000iou6nblbijbxg	store_name	DIVINITTYS	string	2026-08-09 15:02:15.963
cmslxli8t000jou6nucmlzv7r	store_email	hola@divinittys.cl	string	2026-08-09 15:02:15.966
cmslxli8u000kou6n2urt7mbz	store_phone	+56 9 xxxx xxxx	string	2026-08-09 15:02:15.967
cmslxli8v000lou6nmihg1zl9	store_address	Santiago, Chile	string	2026-08-09 15:02:15.968
cmslxli8w000mou6naqf8ab0e	currency	CLP	string	2026-08-09 15:02:15.969
cmslxli8x000nou6nwwimvgjh	free_shipping_threshold	50000	number	2026-08-09 15:02:15.97
cmslxli8z000oou6nd2ecz0wk	tax_rate	0.19	number	2026-08-09 15:02:15.971
cmslxli8z000pou6nvh4ovfsm	maintenance_mode	false	boolean	2026-08-09 15:02:15.972
\.


--
-- Data for Name: shipment_events; Type: TABLE DATA; Schema: public; Owner: divinittys
--

COPY public.shipment_events (id, "shipmentId", status, description, location, "timestamp") FROM stdin;
\.


--
-- Data for Name: shipments; Type: TABLE DATA; Schema: public; Owner: divinittys
--

COPY public.shipments (id, "orderId", carrier, "trackingNumber", "trackingUrl", "labelUrl", status, "estimatedDays", "shippingCost", "packageWeight", "packageDimensions", "originData", "destinationData", "externalData", "shippedAt", "deliveredAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: subscribers; Type: TABLE DATA; Schema: public; Owner: divinittys
--

COPY public.subscribers (id, email, name, "isActive", source, "createdAt") FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: divinittys
--

COPY public.users (id, email, "emailVerified", name, phone, "passwordHash", role, avatar, "isActive", "createdAt", "updatedAt") FROM stdin;
cmslxli7r0000ou6nqs72dgrb	admin@divinittys.cl	2026-08-09 15:02:15.847	Administrador	\N	$2a$12$2gADybm2bO.h870NJa9AdOKTXP5jBx2YcnkIYsdWmrc7xxtziUk9O	SUPER_ADMIN	\N	t	2026-08-09 15:02:15.927	2026-08-09 15:02:15.927
\.


--
-- Data for Name: vendor_payouts; Type: TABLE DATA; Schema: public; Owner: divinittys
--

COPY public.vendor_payouts (id, "vendorId", amount, currency, status, reference, notes, "createdAt", "paidAt") FROM stdin;
\.


--
-- Data for Name: vendors; Type: TABLE DATA; Schema: public; Owner: divinittys
--

COPY public.vendors (id, "userId", "shopName", slug, description, logo, "isActive", commission, "bankAccount", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: wishlist_items; Type: TABLE DATA; Schema: public; Owner: divinittys
--

COPY public.wishlist_items (id, "userId", "productId", "createdAt") FROM stdin;
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_pkey PRIMARY KEY (id);


--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: hair_profiles hair_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.hair_profiles
    ADD CONSTRAINT hair_profiles_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: product_attributes product_attributes_pkey; Type: CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.product_attributes
    ADD CONSTRAINT product_attributes_pkey PRIMARY KEY (id);


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);


--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: shipment_events shipment_events_pkey; Type: CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.shipment_events
    ADD CONSTRAINT shipment_events_pkey PRIMARY KEY (id);


--
-- Name: shipments shipments_pkey; Type: CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT shipments_pkey PRIMARY KEY (id);


--
-- Name: subscribers subscribers_pkey; Type: CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.subscribers
    ADD CONSTRAINT subscribers_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vendor_payouts vendor_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.vendor_payouts
    ADD CONSTRAINT vendor_payouts_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: wishlist_items wishlist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_pkey PRIMARY KEY (id);


--
-- Name: brands_name_key; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE UNIQUE INDEX brands_name_key ON public.brands USING btree (name);


--
-- Name: brands_slug_key; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE UNIQUE INDEX brands_slug_key ON public.brands USING btree (slug);


--
-- Name: categories_name_key; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE UNIQUE INDEX categories_name_key ON public.categories USING btree (name);


--
-- Name: categories_slug_key; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE UNIQUE INDEX categories_slug_key ON public.categories USING btree (slug);


--
-- Name: coupons_code_key; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE UNIQUE INDEX coupons_code_key ON public.coupons USING btree (code);


--
-- Name: hair_profiles_userId_key; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE UNIQUE INDEX "hair_profiles_userId_key" ON public.hair_profiles USING btree ("userId");


--
-- Name: inventory_productId_key; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE UNIQUE INDEX "inventory_productId_key" ON public.inventory USING btree ("productId");


--
-- Name: orders_orderNumber_idx; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE INDEX "orders_orderNumber_idx" ON public.orders USING btree ("orderNumber");


--
-- Name: orders_orderNumber_key; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE UNIQUE INDEX "orders_orderNumber_key" ON public.orders USING btree ("orderNumber");


--
-- Name: orders_status_idx; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE INDEX orders_status_idx ON public.orders USING btree (status);


--
-- Name: orders_userId_idx; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE INDEX "orders_userId_idx" ON public.orders USING btree ("userId");


--
-- Name: payments_orderId_key; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE UNIQUE INDEX "payments_orderId_key" ON public.payments USING btree ("orderId");


--
-- Name: product_variants_sku_key; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE UNIQUE INDEX product_variants_sku_key ON public.product_variants USING btree (sku);


--
-- Name: products_brandId_idx; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE INDEX "products_brandId_idx" ON public.products USING btree ("brandId");


--
-- Name: products_categoryId_idx; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE INDEX "products_categoryId_idx" ON public.products USING btree ("categoryId");


--
-- Name: products_isActive_isFeatured_idx; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE INDEX "products_isActive_isFeatured_idx" ON public.products USING btree ("isActive", "isFeatured");


--
-- Name: products_sku_key; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE UNIQUE INDEX products_sku_key ON public.products USING btree (sku);


--
-- Name: products_slug_idx; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE INDEX products_slug_idx ON public.products USING btree (slug);


--
-- Name: products_slug_key; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE UNIQUE INDEX products_slug_key ON public.products USING btree (slug);


--
-- Name: products_vendorId_idx; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE INDEX "products_vendorId_idx" ON public.products USING btree ("vendorId");


--
-- Name: reviews_productId_userId_key; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE UNIQUE INDEX "reviews_productId_userId_key" ON public.reviews USING btree ("productId", "userId");


--
-- Name: sessions_refreshToken_key; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE UNIQUE INDEX "sessions_refreshToken_key" ON public.sessions USING btree ("refreshToken");


--
-- Name: settings_key_key; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE UNIQUE INDEX settings_key_key ON public.settings USING btree (key);


--
-- Name: shipments_orderId_key; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE UNIQUE INDEX "shipments_orderId_key" ON public.shipments USING btree ("orderId");


--
-- Name: subscribers_email_key; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE UNIQUE INDEX subscribers_email_key ON public.subscribers USING btree (email);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: vendor_payouts_vendorId_idx; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE INDEX "vendor_payouts_vendorId_idx" ON public.vendor_payouts USING btree ("vendorId");


--
-- Name: vendors_slug_key; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE UNIQUE INDEX vendors_slug_key ON public.vendors USING btree (slug);


--
-- Name: vendors_userId_key; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE UNIQUE INDEX "vendors_userId_key" ON public.vendors USING btree ("userId");


--
-- Name: wishlist_items_userId_productId_key; Type: INDEX; Schema: public; Owner: divinittys
--

CREATE UNIQUE INDEX "wishlist_items_userId_productId_key" ON public.wishlist_items USING btree ("userId", "productId");


--
-- Name: addresses addresses_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT "addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: categories categories_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: hair_profiles hair_profiles_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.hair_profiles
    ADD CONSTRAINT "hair_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: inventory inventory_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT "inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: order_items order_items_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: order_items order_items_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: order_items order_items_variantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT "order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES public.product_variants(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: orders orders_addressId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "orders_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES public.addresses(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: orders orders_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: payments payments_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: product_attributes product_attributes_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.product_attributes
    ADD CONSTRAINT "product_attributes_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: product_images product_images_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT "product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: product_variants product_variants_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: products products_brandId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES public.brands(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: products products_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: products products_vendorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "products_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES public.vendors(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: reviews reviews_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT "reviews_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: reviews reviews_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT "reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sessions sessions_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: shipment_events shipment_events_shipmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.shipment_events
    ADD CONSTRAINT "shipment_events_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES public.shipments(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: shipments shipments_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT "shipments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: vendor_payouts vendor_payouts_vendorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.vendor_payouts
    ADD CONSTRAINT "vendor_payouts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES public.vendors(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: vendors vendors_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT "vendors_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: wishlist_items wishlist_items_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT "wishlist_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: wishlist_items wishlist_items_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: divinittys
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT "wishlist_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict lV2hd68saIeFZME0dDoowDrs5AFy8QYcO1YyK4HDCutSUgfArv6FSE1M559QOjQ

