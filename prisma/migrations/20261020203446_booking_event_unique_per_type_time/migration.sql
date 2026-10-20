ALTER TABLE "BookingEvent" ADD CONSTRAINT "booking_event_unique_per_type_time" UNIQUE ("bookingId", "type", "occurredAt");
