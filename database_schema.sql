--
-- PostgreSQL database dump
--

\restrict s2hmMJDpYxw1KGARjFHqDg0igJcaf6d1mp1xKN5e1J384YMugDfPU1eMNZC1zBR

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_role_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_sessions DROP CONSTRAINT IF EXISTS user_sessions_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_notifications DROP CONSTRAINT IF EXISTS user_notifications_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_notifications DROP CONSTRAINT IF EXISTS user_notifications_car_rental_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_notifications DROP CONSTRAINT IF EXISTS user_notifications_bus_booking_id_fkey;
ALTER TABLE IF EXISTS ONLY public.transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.transactions DROP CONSTRAINT IF EXISTS transactions_bus_booking_id_fkey;
ALTER TABLE IF EXISTS ONLY public.rental_driver_reviews DROP CONSTRAINT IF EXISTS rental_driver_reviews_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.rental_driver_reviews DROP CONSTRAINT IF EXISTS rental_driver_reviews_driver_id_fkey;
ALTER TABLE IF EXISTS ONLY public.rental_driver_reviews DROP CONSTRAINT IF EXISTS rental_driver_reviews_admin_replied_by_fkey;
ALTER TABLE IF EXISTS ONLY public.rental_cars DROP CONSTRAINT IF EXISTS rental_cars_owner_id_fkey;
ALTER TABLE IF EXISTS ONLY public.daily_route_templates DROP CONSTRAINT IF EXISTS daily_route_templates_bus_id_fkey;
ALTER TABLE IF EXISTS ONLY public.car_rentals DROP CONSTRAINT IF EXISTS car_rentals_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.car_rentals DROP CONSTRAINT IF EXISTS car_rentals_hired_driver_id_fkey;
ALTER TABLE IF EXISTS ONLY public.car_rentals DROP CONSTRAINT IF EXISTS car_rentals_car_id_fkey;
ALTER TABLE IF EXISTS ONLY public.buses DROP CONSTRAINT IF EXISTS buses_seat_map_template_id_fkey;
ALTER TABLE IF EXISTS ONLY public.bus_trip_feedback DROP CONSTRAINT IF EXISTS bus_trip_feedback_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.bus_trip_feedback DROP CONSTRAINT IF EXISTS bus_trip_feedback_route_id_fkey;
ALTER TABLE IF EXISTS ONLY public.bus_trip_feedback DROP CONSTRAINT IF EXISTS bus_trip_feedback_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.bus_trip_feedback DROP CONSTRAINT IF EXISTS bus_trip_feedback_bus_id_fkey;
ALTER TABLE IF EXISTS ONLY public.bus_trip_feedback DROP CONSTRAINT IF EXISTS bus_trip_feedback_bus_booking_id_fkey;
ALTER TABLE IF EXISTS ONLY public.bus_trip_feedback DROP CONSTRAINT IF EXISTS bus_trip_feedback_admin_replied_by_fkey;
ALTER TABLE IF EXISTS ONLY public.bus_seats DROP CONSTRAINT IF EXISTS bus_seats_route_id_fkey;
ALTER TABLE IF EXISTS ONLY public.bus_seat_map_templates DROP CONSTRAINT IF EXISTS bus_seat_map_templates_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.bus_seat_map_history DROP CONSTRAINT IF EXISTS bus_seat_map_history_template_id_fkey;
ALTER TABLE IF EXISTS ONLY public.bus_seat_map_history DROP CONSTRAINT IF EXISTS bus_seat_map_history_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.bus_seat_map_history DROP CONSTRAINT IF EXISTS bus_seat_map_history_bus_id_fkey;
ALTER TABLE IF EXISTS ONLY public.bus_routes DROP CONSTRAINT IF EXISTS bus_routes_daily_template_id_fkey;
ALTER TABLE IF EXISTS ONLY public.bus_routes DROP CONSTRAINT IF EXISTS bus_routes_bus_id_fkey;
ALTER TABLE IF EXISTS ONLY public.bus_bookings DROP CONSTRAINT IF EXISTS bus_bookings_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.bus_bookings DROP CONSTRAINT IF EXISTS bus_bookings_route_id_fkey;
ALTER TABLE IF EXISTS ONLY public.booking_recovery_events DROP CONSTRAINT IF EXISTS booking_recovery_events_old_route_id_fkey;
ALTER TABLE IF EXISTS ONLY public.booking_recovery_events DROP CONSTRAINT IF EXISTS booking_recovery_events_new_route_id_fkey;
ALTER TABLE IF EXISTS ONLY public.booking_recovery_events DROP CONSTRAINT IF EXISTS booking_recovery_events_booking_id_fkey;
DROP INDEX IF EXISTS public.idx_user_bookings;
DROP INDEX IF EXISTS public.idx_bus_routes_search;
DROP INDEX IF EXISTS public.idx_bus_routes_daily_template_date;
DROP INDEX IF EXISTS public.idx_bus_bookings_active_route_seat_unique;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_phone_key;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE IF EXISTS ONLY public.user_sessions DROP CONSTRAINT IF EXISTS user_sessions_pkey;
ALTER TABLE IF EXISTS ONLY public.user_notifications DROP CONSTRAINT IF EXISTS user_notifications_pkey;
ALTER TABLE IF EXISTS ONLY public.transactions DROP CONSTRAINT IF EXISTS transactions_pkey;
ALTER TABLE IF EXISTS ONLY public.roles DROP CONSTRAINT IF EXISTS roles_pkey;
ALTER TABLE IF EXISTS ONLY public.roles DROP CONSTRAINT IF EXISTS roles_name_key;
ALTER TABLE IF EXISTS ONLY public.rental_drivers DROP CONSTRAINT IF EXISTS rental_drivers_pkey;
ALTER TABLE IF EXISTS ONLY public.rental_drivers DROP CONSTRAINT IF EXISTS rental_drivers_license_number_key;
ALTER TABLE IF EXISTS ONLY public.rental_driver_reviews DROP CONSTRAINT IF EXISTS rental_driver_reviews_pkey;
ALTER TABLE IF EXISTS ONLY public.rental_cars DROP CONSTRAINT IF EXISTS rental_cars_plate_number_key;
ALTER TABLE IF EXISTS ONLY public.rental_cars DROP CONSTRAINT IF EXISTS rental_cars_pkey;
ALTER TABLE IF EXISTS ONLY public.destinations DROP CONSTRAINT IF EXISTS destinations_pkey;
ALTER TABLE IF EXISTS ONLY public.destinations DROP CONSTRAINT IF EXISTS destinations_name_key;
ALTER TABLE IF EXISTS ONLY public.dashboard_monthly_expenses DROP CONSTRAINT IF EXISTS dashboard_monthly_expenses_pkey;
ALTER TABLE IF EXISTS ONLY public.dashboard_monthly_expenses DROP CONSTRAINT IF EXISTS dashboard_monthly_expenses_month_key_key;
ALTER TABLE IF EXISTS ONLY public.daily_route_templates DROP CONSTRAINT IF EXISTS daily_route_templates_pkey;
ALTER TABLE IF EXISTS ONLY public.companies DROP CONSTRAINT IF EXISTS companies_pkey;
ALTER TABLE IF EXISTS ONLY public.companies DROP CONSTRAINT IF EXISTS companies_name_key;
ALTER TABLE IF EXISTS ONLY public.car_rentals DROP CONSTRAINT IF EXISTS car_rentals_pkey;
ALTER TABLE IF EXISTS ONLY public.buses DROP CONSTRAINT IF EXISTS buses_plate_number_key;
ALTER TABLE IF EXISTS ONLY public.buses DROP CONSTRAINT IF EXISTS buses_pkey;
ALTER TABLE IF EXISTS ONLY public.bus_trip_feedback DROP CONSTRAINT IF EXISTS bus_trip_feedback_pkey;
ALTER TABLE IF EXISTS ONLY public.bus_seats DROP CONSTRAINT IF EXISTS bus_seats_route_id_seat_number_key;
ALTER TABLE IF EXISTS ONLY public.bus_seats DROP CONSTRAINT IF EXISTS bus_seats_pkey;
ALTER TABLE IF EXISTS ONLY public.bus_seat_map_templates DROP CONSTRAINT IF EXISTS bus_seat_map_templates_pkey;
ALTER TABLE IF EXISTS ONLY public.bus_seat_map_history DROP CONSTRAINT IF EXISTS bus_seat_map_history_pkey;
ALTER TABLE IF EXISTS ONLY public.bus_routes DROP CONSTRAINT IF EXISTS bus_routes_pkey;
ALTER TABLE IF EXISTS ONLY public.bus_bookings DROP CONSTRAINT IF EXISTS bus_bookings_pkey;
ALTER TABLE IF EXISTS ONLY public.booking_recovery_events DROP CONSTRAINT IF EXISTS booking_recovery_events_pkey;
ALTER TABLE IF EXISTS public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.user_sessions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.user_notifications ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.transactions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.roles ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.rental_drivers ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.rental_driver_reviews ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.rental_cars ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.destinations ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.dashboard_monthly_expenses ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.daily_route_templates ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.companies ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.car_rentals ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.buses ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.bus_trip_feedback ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.bus_seats ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.bus_seat_map_templates ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.bus_seat_map_history ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.bus_routes ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.bus_bookings ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.booking_recovery_events ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.users_id_seq;
DROP TABLE IF EXISTS public.users;
DROP SEQUENCE IF EXISTS public.user_sessions_id_seq;
DROP TABLE IF EXISTS public.user_sessions;
DROP SEQUENCE IF EXISTS public.user_notifications_id_seq;
DROP TABLE IF EXISTS public.user_notifications;
DROP SEQUENCE IF EXISTS public.transactions_id_seq;
DROP TABLE IF EXISTS public.transactions;
DROP SEQUENCE IF EXISTS public.roles_id_seq;
DROP TABLE IF EXISTS public.roles;
DROP SEQUENCE IF EXISTS public.rental_drivers_id_seq;
DROP TABLE IF EXISTS public.rental_drivers;
DROP SEQUENCE IF EXISTS public.rental_driver_reviews_id_seq;
DROP TABLE IF EXISTS public.rental_driver_reviews;
DROP SEQUENCE IF EXISTS public.rental_cars_id_seq;
DROP TABLE IF EXISTS public.rental_cars;
DROP SEQUENCE IF EXISTS public.destinations_id_seq;
DROP TABLE IF EXISTS public.destinations;
DROP SEQUENCE IF EXISTS public.dashboard_monthly_expenses_id_seq;
DROP TABLE IF EXISTS public.dashboard_monthly_expenses;
DROP SEQUENCE IF EXISTS public.daily_route_templates_id_seq;
DROP TABLE IF EXISTS public.daily_route_templates;
DROP SEQUENCE IF EXISTS public.companies_id_seq;
DROP TABLE IF EXISTS public.companies;
DROP SEQUENCE IF EXISTS public.car_rentals_id_seq;
DROP TABLE IF EXISTS public.car_rentals;
DROP SEQUENCE IF EXISTS public.buses_id_seq;
DROP TABLE IF EXISTS public.buses;
DROP SEQUENCE IF EXISTS public.bus_trip_feedback_id_seq;
DROP TABLE IF EXISTS public.bus_trip_feedback;
DROP SEQUENCE IF EXISTS public.bus_seats_id_seq;
DROP TABLE IF EXISTS public.bus_seats;
DROP SEQUENCE IF EXISTS public.bus_seat_map_templates_id_seq;
DROP TABLE IF EXISTS public.bus_seat_map_templates;
DROP SEQUENCE IF EXISTS public.bus_seat_map_history_id_seq;
DROP TABLE IF EXISTS public.bus_seat_map_history;
DROP SEQUENCE IF EXISTS public.bus_routes_id_seq;
DROP TABLE IF EXISTS public.bus_routes;
DROP SEQUENCE IF EXISTS public.bus_bookings_id_seq;
DROP TABLE IF EXISTS public.bus_bookings;
DROP SEQUENCE IF EXISTS public.booking_recovery_events_id_seq;
DROP TABLE IF EXISTS public.booking_recovery_events;
DROP TYPE IF EXISTS public.vehicle_status;
DROP TYPE IF EXISTS public.user_role;
DROP TYPE IF EXISTS public.payment_method;
DROP TYPE IF EXISTS public.booking_status;
DROP SCHEMA IF EXISTS public;
--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: booking_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.booking_status AS ENUM (
    'pending',
    'confirmed',
    'completed',
    'cancelled',
    'returned'
);


--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_method AS ENUM (
    'aba',
    'khqr',
    'cash'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'user',
    'admin'
);


--
-- Name: vehicle_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vehicle_status AS ENUM (
    'available',
    'rented',
    'maintenance'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: booking_recovery_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_recovery_events (
    id integer NOT NULL,
    booking_id integer,
    old_route_id integer,
    new_route_id integer,
    old_seat_number character varying(10),
    new_seat_number character varying(10),
    reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: booking_recovery_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.booking_recovery_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: booking_recovery_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.booking_recovery_events_id_seq OWNED BY public.booking_recovery_events.id;


--
-- Name: bus_bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bus_bookings (
    id integer NOT NULL,
    user_id integer,
    route_id integer,
    seat_number character varying(10) NOT NULL,
    total_price numeric(10,2) NOT NULL,
    payment_method character varying(50),
    status public.booking_status DEFAULT 'pending'::public.booking_status,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    package_weight_kg numeric(8,2) DEFAULT 0,
    overweight_charge numeric(10,2) DEFAULT 0,
    booking_reference character varying(40),
    passenger_first_name character varying(100),
    passenger_last_name character varying(100),
    passenger_phone character varying(30),
    passenger_email character varying(150),
    passenger_id_number character varying(80),
    round_trip_reference character varying(40),
    trip_leg character varying(20) DEFAULT 'outbound'::character varying,
    original_price numeric(10,2),
    discount_amount numeric(10,2) DEFAULT 0
);


--
-- Name: bus_bookings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bus_bookings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bus_bookings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bus_bookings_id_seq OWNED BY public.bus_bookings.id;


--
-- Name: bus_routes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bus_routes (
    id integer NOT NULL,
    bus_id integer,
    origin character varying(100) NOT NULL,
    destination character varying(100) NOT NULL,
    departure_time timestamp without time zone NOT NULL,
    arrival_time timestamp without time zone NOT NULL,
    price numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    daily_template_id integer,
    service_date date,
    is_generated boolean DEFAULT false,
    availability_status character varying(20) DEFAULT 'available'::character varying,
    maintenance_start timestamp without time zone,
    maintenance_end timestamp without time zone
);


--
-- Name: bus_routes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bus_routes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bus_routes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bus_routes_id_seq OWNED BY public.bus_routes.id;


--
-- Name: bus_seat_map_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bus_seat_map_history (
    id integer NOT NULL,
    company_id integer,
    bus_id integer,
    template_id integer,
    vehicle_type character varying(100) NOT NULL,
    name character varying(120) NOT NULL,
    rows integer NOT NULL,
    columns integer NOT NULL,
    seat_count integer DEFAULT 0 NOT NULL,
    layout_json jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: bus_seat_map_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bus_seat_map_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bus_seat_map_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bus_seat_map_history_id_seq OWNED BY public.bus_seat_map_history.id;


--
-- Name: bus_seat_map_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bus_seat_map_templates (
    id integer NOT NULL,
    company_id integer,
    vehicle_type character varying(100) NOT NULL,
    name character varying(120) NOT NULL,
    rows integer NOT NULL,
    columns integer NOT NULL,
    seat_count integer DEFAULT 0 NOT NULL,
    layout_json jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: bus_seat_map_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bus_seat_map_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bus_seat_map_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bus_seat_map_templates_id_seq OWNED BY public.bus_seat_map_templates.id;


--
-- Name: bus_seats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bus_seats (
    id integer NOT NULL,
    route_id integer,
    seat_number character varying(10) NOT NULL,
    is_booked boolean DEFAULT false
);


--
-- Name: bus_seats_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bus_seats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bus_seats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bus_seats_id_seq OWNED BY public.bus_seats.id;


--
-- Name: bus_trip_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bus_trip_feedback (
    id integer NOT NULL,
    user_id integer,
    bus_booking_id integer,
    route_id integer,
    company_id integer,
    bus_id integer,
    feedback_type character varying(20) NOT NULL,
    comment text NOT NULL,
    admin_reply text,
    admin_replied_at timestamp without time zone,
    admin_replied_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT bus_trip_feedback_feedback_type_check CHECK (((feedback_type)::text = ANY ((ARRAY['comment'::character varying, 'report'::character varying])::text[])))
);


--
-- Name: bus_trip_feedback_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bus_trip_feedback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bus_trip_feedback_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bus_trip_feedback_id_seq OWNED BY public.bus_trip_feedback.id;


--
-- Name: buses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.buses (
    id integer NOT NULL,
    company_id integer,
    name character varying(150) NOT NULL,
    type character varying(50) NOT NULL,
    plate_number character varying(20),
    total_seats integer NOT NULL,
    status public.vehicle_status DEFAULT 'available'::public.vehicle_status,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    seat_map_template_id integer,
    seat_map_override jsonb,
    maintenance_start timestamp without time zone,
    maintenance_end timestamp without time zone
);


--
-- Name: buses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.buses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: buses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.buses_id_seq OWNED BY public.buses.id;


--
-- Name: car_rentals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.car_rentals (
    id integer NOT NULL,
    user_id integer,
    car_id integer,
    pickup_date date NOT NULL,
    return_date date NOT NULL,
    driver_name character varying(150) NOT NULL,
    driver_license character varying(50) NOT NULL,
    total_price numeric(10,2) NOT NULL,
    payment_method public.payment_method NOT NULL,
    status public.booking_status DEFAULT 'pending'::public.booking_status,
    booked_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    pickup_datetime timestamp without time zone,
    return_datetime timestamp without time zone,
    rental_hours numeric(8,2),
    hourly_charge numeric(10,2),
    returned_at timestamp without time zone,
    customer_phone character varying(30),
    hired_driver_id integer,
    rental_base_price numeric(10,2) DEFAULT 0,
    driver_fee numeric(10,2) DEFAULT 0,
    late_return_hours numeric(8,2) DEFAULT 0,
    late_return_charge numeric(10,2) DEFAULT 0,
    damage_description text DEFAULT ''::text,
    damage_charge numeric(10,2) DEFAULT 0,
    damage_responsibility character varying(20) DEFAULT 'renter'::character varying,
    CONSTRAINT car_rentals_status_rental_only CHECK (((status)::text = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled'::text, 'returned'::text])))
);


--
-- Name: car_rentals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.car_rentals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: car_rentals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.car_rentals_id_seq OWNED BY public.car_rentals.id;


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id integer NOT NULL,
    name character varying(150) NOT NULL,
    theme_color character varying(20),
    theme_bg character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: companies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.companies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: companies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.companies_id_seq OWNED BY public.companies.id;


--
-- Name: daily_route_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_route_templates (
    id integer NOT NULL,
    bus_id integer,
    origin character varying(100) NOT NULL,
    destination character varying(100) NOT NULL,
    departure_time time without time zone NOT NULL,
    arrival_time time without time zone NOT NULL,
    price numeric(10,2) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: daily_route_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_route_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: daily_route_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_route_templates_id_seq OWNED BY public.daily_route_templates.id;


--
-- Name: dashboard_monthly_expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboard_monthly_expenses (
    id integer NOT NULL,
    month_key character varying(7) NOT NULL,
    total_expense numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: dashboard_monthly_expenses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dashboard_monthly_expenses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dashboard_monthly_expenses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dashboard_monthly_expenses_id_seq OWNED BY public.dashboard_monthly_expenses.id;


--
-- Name: destinations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.destinations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: destinations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.destinations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: destinations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.destinations_id_seq OWNED BY public.destinations.id;


--
-- Name: rental_cars; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rental_cars (
    id integer NOT NULL,
    owner_id integer,
    name character varying(150) NOT NULL,
    type character varying(50) NOT NULL,
    plate_number character varying(20),
    total_seats integer NOT NULL,
    transmission character varying(20),
    daily_rate numeric(10,2) NOT NULL,
    status public.vehicle_status DEFAULT 'available'::public.vehicle_status,
    photos text[],
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: rental_cars_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rental_cars_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rental_cars_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rental_cars_id_seq OWNED BY public.rental_cars.id;


--
-- Name: rental_driver_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rental_driver_reviews (
    id integer NOT NULL,
    driver_id integer,
    user_id integer,
    rating integer,
    comment text NOT NULL,
    review_type character varying(20) DEFAULT 'review'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    car_rental_id integer,
    admin_reply text,
    admin_replied_at timestamp without time zone,
    admin_replied_by integer,
    CONSTRAINT rental_driver_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT rental_driver_reviews_review_type_check CHECK (((review_type)::text = ANY ((ARRAY['review'::character varying, 'report'::character varying])::text[])))
);


--
-- Name: rental_driver_reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rental_driver_reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rental_driver_reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rental_driver_reviews_id_seq OWNED BY public.rental_driver_reviews.id;


--
-- Name: rental_drivers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rental_drivers (
    id integer NOT NULL,
    name character varying(150) NOT NULL,
    license_number character varying(50) NOT NULL,
    phone character varying(30),
    rating numeric(3,2) DEFAULT 5.00,
    review_count integer DEFAULT 0,
    hourly_rate numeric(10,2) NOT NULL,
    status character varying(20) DEFAULT 'available'::character varying,
    profile_photo text,
    background text,
    experience_years integer DEFAULT 0,
    languages text[] DEFAULT ARRAY[]::text[],
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT rental_drivers_status_check CHECK (((status)::text = ANY ((ARRAY['available'::character varying, 'inactive'::character varying])::text[])))
);


--
-- Name: rental_drivers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rental_drivers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rental_drivers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rental_drivers_id_seq OWNED BY public.rental_drivers.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    label character varying(100) NOT NULL,
    description text,
    is_system boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id integer NOT NULL,
    user_id integer,
    bus_booking_id integer,
    car_rental_id integer,
    amount numeric(10,2) NOT NULL,
    payment_method public.payment_method NOT NULL,
    status character varying(20) DEFAULT 'success'::character varying,
    paid_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT transactions_check CHECK ((((bus_booking_id IS NOT NULL) AND (car_rental_id IS NULL)) OR ((bus_booking_id IS NULL) AND (car_rental_id IS NOT NULL))))
);


--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: user_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_notifications (
    id integer NOT NULL,
    user_id integer,
    car_rental_id integer,
    type character varying(50) NOT NULL,
    title character varying(150) NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    read_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    bus_booking_id integer,
    booking_reference character varying(80),
    action_url text,
    action_type character varying(50),
    metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: user_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_notifications_id_seq OWNED BY public.user_notifications.id;


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_sessions (
    id integer NOT NULL,
    user_id integer,
    token_hash character varying(255) NOT NULL,
    session_type character varying(20) DEFAULT 'access'::character varying,
    expires_at timestamp without time zone NOT NULL,
    is_revoked boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: user_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_sessions_id_seq OWNED BY public.user_sessions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(20) NOT NULL,
    national_id character varying(50),
    password_hash character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'user'::public.user_role,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true,
    role_id integer DEFAULT 1,
    last_activity_at timestamp without time zone
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: booking_recovery_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_recovery_events ALTER COLUMN id SET DEFAULT nextval('public.booking_recovery_events_id_seq'::regclass);


--
-- Name: bus_bookings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_bookings ALTER COLUMN id SET DEFAULT nextval('public.bus_bookings_id_seq'::regclass);


--
-- Name: bus_routes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_routes ALTER COLUMN id SET DEFAULT nextval('public.bus_routes_id_seq'::regclass);


--
-- Name: bus_seat_map_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_seat_map_history ALTER COLUMN id SET DEFAULT nextval('public.bus_seat_map_history_id_seq'::regclass);


--
-- Name: bus_seat_map_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_seat_map_templates ALTER COLUMN id SET DEFAULT nextval('public.bus_seat_map_templates_id_seq'::regclass);


--
-- Name: bus_seats id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_seats ALTER COLUMN id SET DEFAULT nextval('public.bus_seats_id_seq'::regclass);


--
-- Name: bus_trip_feedback id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_trip_feedback ALTER COLUMN id SET DEFAULT nextval('public.bus_trip_feedback_id_seq'::regclass);


--
-- Name: buses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buses ALTER COLUMN id SET DEFAULT nextval('public.buses_id_seq'::regclass);


--
-- Name: car_rentals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.car_rentals ALTER COLUMN id SET DEFAULT nextval('public.car_rentals_id_seq'::regclass);


--
-- Name: companies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies ALTER COLUMN id SET DEFAULT nextval('public.companies_id_seq'::regclass);


--
-- Name: daily_route_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_route_templates ALTER COLUMN id SET DEFAULT nextval('public.daily_route_templates_id_seq'::regclass);


--
-- Name: dashboard_monthly_expenses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_monthly_expenses ALTER COLUMN id SET DEFAULT nextval('public.dashboard_monthly_expenses_id_seq'::regclass);


--
-- Name: destinations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.destinations ALTER COLUMN id SET DEFAULT nextval('public.destinations_id_seq'::regclass);


--
-- Name: rental_cars id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rental_cars ALTER COLUMN id SET DEFAULT nextval('public.rental_cars_id_seq'::regclass);


--
-- Name: rental_driver_reviews id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rental_driver_reviews ALTER COLUMN id SET DEFAULT nextval('public.rental_driver_reviews_id_seq'::regclass);


--
-- Name: rental_drivers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rental_drivers ALTER COLUMN id SET DEFAULT nextval('public.rental_drivers_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: user_notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notifications ALTER COLUMN id SET DEFAULT nextval('public.user_notifications_id_seq'::regclass);


--
-- Name: user_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions ALTER COLUMN id SET DEFAULT nextval('public.user_sessions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: booking_recovery_events booking_recovery_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_recovery_events
    ADD CONSTRAINT booking_recovery_events_pkey PRIMARY KEY (id);


--
-- Name: bus_bookings bus_bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_bookings
    ADD CONSTRAINT bus_bookings_pkey PRIMARY KEY (id);


--
-- Name: bus_routes bus_routes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_routes
    ADD CONSTRAINT bus_routes_pkey PRIMARY KEY (id);


--
-- Name: bus_seat_map_history bus_seat_map_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_seat_map_history
    ADD CONSTRAINT bus_seat_map_history_pkey PRIMARY KEY (id);


--
-- Name: bus_seat_map_templates bus_seat_map_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_seat_map_templates
    ADD CONSTRAINT bus_seat_map_templates_pkey PRIMARY KEY (id);


--
-- Name: bus_seats bus_seats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_seats
    ADD CONSTRAINT bus_seats_pkey PRIMARY KEY (id);


--
-- Name: bus_seats bus_seats_route_id_seat_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_seats
    ADD CONSTRAINT bus_seats_route_id_seat_number_key UNIQUE (route_id, seat_number);


--
-- Name: bus_trip_feedback bus_trip_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_trip_feedback
    ADD CONSTRAINT bus_trip_feedback_pkey PRIMARY KEY (id);


--
-- Name: buses buses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buses
    ADD CONSTRAINT buses_pkey PRIMARY KEY (id);


--
-- Name: buses buses_plate_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buses
    ADD CONSTRAINT buses_plate_number_key UNIQUE (plate_number);


--
-- Name: car_rentals car_rentals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.car_rentals
    ADD CONSTRAINT car_rentals_pkey PRIMARY KEY (id);


--
-- Name: companies companies_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_name_key UNIQUE (name);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: daily_route_templates daily_route_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_route_templates
    ADD CONSTRAINT daily_route_templates_pkey PRIMARY KEY (id);


--
-- Name: dashboard_monthly_expenses dashboard_monthly_expenses_month_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_monthly_expenses
    ADD CONSTRAINT dashboard_monthly_expenses_month_key_key UNIQUE (month_key);


--
-- Name: dashboard_monthly_expenses dashboard_monthly_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_monthly_expenses
    ADD CONSTRAINT dashboard_monthly_expenses_pkey PRIMARY KEY (id);


--
-- Name: destinations destinations_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.destinations
    ADD CONSTRAINT destinations_name_key UNIQUE (name);


--
-- Name: destinations destinations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.destinations
    ADD CONSTRAINT destinations_pkey PRIMARY KEY (id);


--
-- Name: rental_cars rental_cars_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rental_cars
    ADD CONSTRAINT rental_cars_pkey PRIMARY KEY (id);


--
-- Name: rental_cars rental_cars_plate_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rental_cars
    ADD CONSTRAINT rental_cars_plate_number_key UNIQUE (plate_number);


--
-- Name: rental_driver_reviews rental_driver_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rental_driver_reviews
    ADD CONSTRAINT rental_driver_reviews_pkey PRIMARY KEY (id);


--
-- Name: rental_drivers rental_drivers_license_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rental_drivers
    ADD CONSTRAINT rental_drivers_license_number_key UNIQUE (license_number);


--
-- Name: rental_drivers rental_drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rental_drivers
    ADD CONSTRAINT rental_drivers_pkey PRIMARY KEY (id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: user_notifications user_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_bus_bookings_active_route_seat_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_bus_bookings_active_route_seat_unique ON public.bus_bookings USING btree (route_id, upper((seat_number)::text)) WHERE (status <> 'cancelled'::public.booking_status);


--
-- Name: idx_bus_routes_daily_template_date; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_bus_routes_daily_template_date ON public.bus_routes USING btree (daily_template_id, service_date) WHERE (daily_template_id IS NOT NULL);


--
-- Name: idx_bus_routes_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bus_routes_search ON public.bus_routes USING btree (origin, destination, departure_time);


--
-- Name: idx_user_bookings; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_bookings ON public.bus_bookings USING btree (user_id);


--
-- Name: booking_recovery_events booking_recovery_events_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_recovery_events
    ADD CONSTRAINT booking_recovery_events_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bus_bookings(id) ON DELETE SET NULL;


--
-- Name: booking_recovery_events booking_recovery_events_new_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_recovery_events
    ADD CONSTRAINT booking_recovery_events_new_route_id_fkey FOREIGN KEY (new_route_id) REFERENCES public.bus_routes(id) ON DELETE SET NULL;


--
-- Name: booking_recovery_events booking_recovery_events_old_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_recovery_events
    ADD CONSTRAINT booking_recovery_events_old_route_id_fkey FOREIGN KEY (old_route_id) REFERENCES public.bus_routes(id) ON DELETE SET NULL;


--
-- Name: bus_bookings bus_bookings_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_bookings
    ADD CONSTRAINT bus_bookings_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.bus_routes(id) ON DELETE CASCADE;


--
-- Name: bus_bookings bus_bookings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_bookings
    ADD CONSTRAINT bus_bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: bus_routes bus_routes_bus_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_routes
    ADD CONSTRAINT bus_routes_bus_id_fkey FOREIGN KEY (bus_id) REFERENCES public.buses(id) ON DELETE CASCADE;


--
-- Name: bus_routes bus_routes_daily_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_routes
    ADD CONSTRAINT bus_routes_daily_template_id_fkey FOREIGN KEY (daily_template_id) REFERENCES public.daily_route_templates(id) ON DELETE SET NULL;


--
-- Name: bus_seat_map_history bus_seat_map_history_bus_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_seat_map_history
    ADD CONSTRAINT bus_seat_map_history_bus_id_fkey FOREIGN KEY (bus_id) REFERENCES public.buses(id) ON DELETE SET NULL;


--
-- Name: bus_seat_map_history bus_seat_map_history_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_seat_map_history
    ADD CONSTRAINT bus_seat_map_history_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: bus_seat_map_history bus_seat_map_history_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_seat_map_history
    ADD CONSTRAINT bus_seat_map_history_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.bus_seat_map_templates(id) ON DELETE SET NULL;


--
-- Name: bus_seat_map_templates bus_seat_map_templates_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_seat_map_templates
    ADD CONSTRAINT bus_seat_map_templates_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: bus_seats bus_seats_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_seats
    ADD CONSTRAINT bus_seats_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.bus_routes(id) ON DELETE CASCADE;


--
-- Name: bus_trip_feedback bus_trip_feedback_admin_replied_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_trip_feedback
    ADD CONSTRAINT bus_trip_feedback_admin_replied_by_fkey FOREIGN KEY (admin_replied_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bus_trip_feedback bus_trip_feedback_bus_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_trip_feedback
    ADD CONSTRAINT bus_trip_feedback_bus_booking_id_fkey FOREIGN KEY (bus_booking_id) REFERENCES public.bus_bookings(id) ON DELETE CASCADE;


--
-- Name: bus_trip_feedback bus_trip_feedback_bus_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_trip_feedback
    ADD CONSTRAINT bus_trip_feedback_bus_id_fkey FOREIGN KEY (bus_id) REFERENCES public.buses(id) ON DELETE SET NULL;


--
-- Name: bus_trip_feedback bus_trip_feedback_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_trip_feedback
    ADD CONSTRAINT bus_trip_feedback_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: bus_trip_feedback bus_trip_feedback_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_trip_feedback
    ADD CONSTRAINT bus_trip_feedback_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.bus_routes(id) ON DELETE SET NULL;


--
-- Name: bus_trip_feedback bus_trip_feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bus_trip_feedback
    ADD CONSTRAINT bus_trip_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: buses buses_seat_map_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buses
    ADD CONSTRAINT buses_seat_map_template_id_fkey FOREIGN KEY (seat_map_template_id) REFERENCES public.bus_seat_map_templates(id) ON DELETE SET NULL;


--
-- Name: car_rentals car_rentals_car_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.car_rentals
    ADD CONSTRAINT car_rentals_car_id_fkey FOREIGN KEY (car_id) REFERENCES public.rental_cars(id) ON DELETE CASCADE;


--
-- Name: car_rentals car_rentals_hired_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.car_rentals
    ADD CONSTRAINT car_rentals_hired_driver_id_fkey FOREIGN KEY (hired_driver_id) REFERENCES public.rental_drivers(id) ON DELETE SET NULL;


--
-- Name: car_rentals car_rentals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.car_rentals
    ADD CONSTRAINT car_rentals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: daily_route_templates daily_route_templates_bus_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_route_templates
    ADD CONSTRAINT daily_route_templates_bus_id_fkey FOREIGN KEY (bus_id) REFERENCES public.buses(id) ON DELETE CASCADE;


--
-- Name: rental_cars rental_cars_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rental_cars
    ADD CONSTRAINT rental_cars_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: rental_driver_reviews rental_driver_reviews_admin_replied_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rental_driver_reviews
    ADD CONSTRAINT rental_driver_reviews_admin_replied_by_fkey FOREIGN KEY (admin_replied_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: rental_driver_reviews rental_driver_reviews_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rental_driver_reviews
    ADD CONSTRAINT rental_driver_reviews_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.rental_drivers(id) ON DELETE CASCADE;


--
-- Name: rental_driver_reviews rental_driver_reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rental_driver_reviews
    ADD CONSTRAINT rental_driver_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_bus_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_bus_booking_id_fkey FOREIGN KEY (bus_booking_id) REFERENCES public.bus_bookings(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_notifications user_notifications_bus_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_bus_booking_id_fkey FOREIGN KEY (bus_booking_id) REFERENCES public.bus_bookings(id) ON DELETE CASCADE;


--
-- Name: user_notifications user_notifications_car_rental_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_car_rental_id_fkey FOREIGN KEY (car_rental_id) REFERENCES public.car_rentals(id) ON DELETE CASCADE;


--
-- Name: user_notifications user_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict s2hmMJDpYxw1KGARjFHqDg0igJcaf6d1mp1xKN5e1J384YMugDfPU1eMNZC1zBR
