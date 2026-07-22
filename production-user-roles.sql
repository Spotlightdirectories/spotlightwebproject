--
-- PostgreSQL database dump
--

\restrict WEdVZ3bp3vfhBMqmNJGfupAL8zmoQdndVjO6GpSkCOJGh0EJg2O1qnf2nraMRXG

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

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

--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: -
--

SET SESSION AUTHORIZATION DEFAULT;

ALTER TABLE public.user_roles DISABLE TRIGGER ALL;

COPY public.user_roles (user_id, role, created_at, assigned_by) FROM stdin;
94e8cab1-55bc-47ef-a8b1-7a7c246c128a	super_admin	2026-07-13 21:46:30.35621+00	\N
a3bfe7be-9d53-4f86-b206-f185e65c0bc4	finance_admin	2026-07-14 04:56:56.1709+00	\N
\.


ALTER TABLE public.user_roles ENABLE TRIGGER ALL;

--
-- PostgreSQL database dump complete
--

\unrestrict WEdVZ3bp3vfhBMqmNJGfupAL8zmoQdndVjO6GpSkCOJGh0EJg2O1qnf2nraMRXG

