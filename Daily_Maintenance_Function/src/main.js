import { Client } from 'node-appwrite';
import { Databases } from 'node-appwrite';
import { Query } from 'node-appwrite';
import { ID } from 'node-appwrite';
 

// Initialize Appwrite Client
const client = new Client();


client
.setEndpoint(process.env.APPWRITE_ENDPOINT) // Appwrite endpoint
.setProject(process.env.APPWRITE_PROJECT_ID) // Project ID
.setKey(process.env.APPWRITE_API_KEY); // API Key

// Ensure that the client is initialized
if (!client) {
  throw new Error("Appwrite Client is not initialized");
}


const database = new Databases(client);
// Ensure database is initialized
if (!database) {
  throw new Error("Appwrite Database is not initialized");
}

// Your Appwrite function to delete expired chat messages
async function deleteChatMessages() {
  try {
    const messagesCollectionId = process.env.CHAT_MESSAGES_COLLECTION_ID;
    const groupsCollectionId = process.env.GROUPS_COLLECTION_ID;
    const databaseId = process.env.DATABASE_ID

    if (!messagesCollectionId || !groupsCollectionId) {
      throw new Error('Missing collection IDs in environment variables');
    }

    const messages = await database.listDocuments(databaseId,messagesCollectionId);

    for (let message of messages.documents) {
      const groupId = message.groupsId;

      const groupExists = await database.listDocuments(
        databaseId,
        groupsCollectionId, [
        Query.equal('$id', groupId),
      ]);

      if (groupExists.documents.length === 0) {
        await database.deleteDocument(
          databaseId,
          messagesCollectionId, 
          message.$id);
        console.log(`Deleted message with ID: ${message.$id}`);
      }
    }
  } catch (error) {
    console.error('Error deleting chat messages:', error);
  }
}

// Your Appwrite function to delete expired instant sale tickets
async function deleteExpiredInstantSaleTickets() {
  try {
    const ticketsForInstantSaleCollectionId = process.env.TICKETS_FOR_INSTANT_SALE_COLLECTION_ID;
    const ticketsCollectionId = process.env.TICKETS_COLLECTION_ID;
    const databaseId = process.env.DATABASE_ID

    if (!ticketsForInstantSaleCollectionId || !ticketsCollectionId) {
      throw new Error('Missing collection IDs in environment variables');
    }

    const tickets = await database.listDocuments(
      databaseId,
      ticketsForInstantSaleCollectionId
    );

    for (let ticket of tickets.documents) {
      const expiryDateStr = ticket.expiry;
      const expiryDateParts = expiryDateStr.split('/');
      const expiryDate = new Date(
        `${expiryDateParts[1]}/${expiryDateParts[0]}/${expiryDateParts[2]}`
      );
      const currentDate = new Date();

      if (expiryDate < currentDate) {
        const originalTicketId = ticket.ticketId;        const listingQuantity = parseInt(ticket.quantity, 10); //convert this string number quantity to integer type 


        const originalTicket = await database.getDocument(
          databaseId,
          ticketsCollectionId, 
          originalTicketId
        );

        const updatedQuantity = parseInt(originalTicket.quantity, 10) + listingQuantity;
        await database.updateDocument(
          databaseId,
          ticketsCollectionId, 
          originalTicketId, 
          {
            quantity: updatedQuantity.toString(),
            isListedForSale: "false",
          }
      );

        console.log(`Updated original ticket with ID: ${originalTicketId}, new quantity: ${updatedQuantity}`);

        await database.deleteDocument(
          databaseId,
          ticketsForInstantSaleCollectionId, 
          ticket.$id
        );
        console.log(`Deleted expired instant sale ticket with ID: ${ticket.$id}`);
      }
    }
  } catch (error) {
    console.error('Error deleting expired instant sale tickets:', error);
  }
}

// Your Appwrite function to move expired tickets
async function moveExpiredTickets() {
  try {
    const ticketsCollectionId = process.env.TICKETS_COLLECTION_ID;
    const expiredTicketsCollectionId = process.env.EXPIRED_TICKETS_COLLECTION_ID;
    const databaseId = process.env.DATABASE_ID;

    if (!ticketsCollectionId || !expiredTicketsCollectionId || !databaseId) {
      throw new Error('Missing collection IDs or database ID in environment variables');
    }

    const tickets = await database.listDocuments(databaseId, ticketsCollectionId);

    for (let ticket of tickets.documents) {
      const eventDateStr = ticket.eventDate;
      const ticketQty = ticket.quantity;
      const eventDate = new Date(eventDateStr);
      const currentDate = new Date();

      console.log('Processing ticket:', ticket);

      // Skip if the event date is invalid
      if (isNaN(eventDate)) {
        console.error('Invalid event date:', eventDateStr);
        continue;
      }

      if (eventDate < currentDate) {

        console.log('Creating document with data:', ticket);

        const ticketData = {
          "eventName": ticket.eventName,
          "eventSub_name": ticket.eventSub_name,
          "eventDate": ticket.eventDate,
          "eventTime": ticket.eventTime,
          "eventLocation": ticket.eventLocation,
          "totalAmountPaid": ticket.totalAmountPaid,
          "imageFileId": ticket.imageFileId,
          "category": ticket.category,
          "userId": ticket.userId,
          "eventId": ticket.eventId,
          "qrCodeFileId": ticket.qrCodeFileId,
          "quantity": ticket.quantity,
          "isListedForSale": ticket.isListedForSale.toString(), // Convert boolean to string
          "checkedIn": ticket.checkedIn,
          "pricePerTicket": ticket.pricePerTicket
        };

        // Create document in expired tickets collection
        const response = await database.createDocument(
          databaseId, 
          expiredTicketsCollectionId, 
          ID.unique(),
          ticketData
        );

        // Delete document from tickets collection
        await database.deleteDocument(databaseId, ticketsCollectionId, ticket.$id);

        console.log(`Moved ticket with ID: ${ticket.$id} to expired tickets collection.`);
      }
      else if  (ticketQty === "0") {
        await database.deleteDocument(
          databaseId,
          ticketsCollectionId, 
          ticket.$id
        );
      }
    }
  } catch (error) {
    console.error('Error moving expired tickets:', error);
  }
}

async function moveExpiredEvents() {
  try {
    const eventsCollectionId = process.env.Event_ID;
    const expiredEventsCollectionId = process.env.Expired_Events_ID;
    const databaseId = process.env.DATABASE_ID;

    if (!eventsCollectionId || !expiredEventsCollectionId || !databaseId) {
      throw new Error('Missing collection IDs or database ID in environment variables');
    }

    const events = await database.listDocuments(databaseId, eventsCollectionId);

    for (let event of events.documents) {
      const eventDateStr = event.date;
      const eventDate = new Date(eventDateStr);
      const currentDate = new Date();

      console.log('Processing event:', event);

      // Skip if the event date is invalid
      if (isNaN(eventDate)) {
        console.error('Invalid event date:', eventDateStr);
        continue;
      }

      if (eventDate < currentDate) {
        console.log('Creating document with data:', event);

        const eventData = {
          "name": event.name,
          "location": event.location,
          "imageFileId": event.imageFileId,
          "time": event.time,
          "sub_name": event.sub_name,
          "date": event.date,
          "price": event.price,
          "eventLocation_Lat_Lng_VenueName": event.eventLocation_Lat_Lng_VenueName,
          "organiserId": event.organiserId,
          "eventInfo": event.eventInfo,
          "totalTickets": event.totalTickets,
          "ticketsLeft": event.ticketsLeft,
          "tags": event.tags || [],
          "phase": event.phase || [],
          "categories": event.categories || []
        };

        // Create document in expired events collection
        const response = await database.createDocument(
          databaseId, 
          expiredEventsCollectionId, 
          ID.unique(),
          eventData
        );

        // Delete document from events collection
        await database.deleteDocument(databaseId, eventsCollectionId, event.$id);

        console.log(`Moved event with ID: ${event.$id} to expired events collection.`);
      }
    }
  } catch (error) {
    console.error('Error moving expired events:', error);
  }
}

// Function to handle fraud tickets
async function handleFraudTickets() {
  try {
    const ticketsCollectionId = process.env.TICKETS_COLLECTION_ID;
    const suspectedFraudTableId = process.env.SUSPECTED_FRAUD_TABLE_ID;
    const databaseId = process.env.DATABASE_ID;

    if (!ticketsCollectionId || !suspectedFraudTableId || !databaseId) {
      throw new Error('Missing collection IDs or database ID in environment variables');
    }

    const tickets = await database.listDocuments(databaseId, ticketsCollectionId);

    for (let ticket of tickets.documents) {
      const totalAmountPaid = parseFloat(ticket.totalAmountPaid);

      if (totalAmountPaid === 0) {
        console.log(`Found fraud ticket with ID: ${ticket.$id}`);

        const ticketData = {
          "eventName": ticket.eventName,
          "eventSub_name": ticket.eventSub_name,
          "eventDate": ticket.eventDate,
          "eventTime": ticket.eventTime,
          "eventLocation": ticket.eventLocation,
          "totalAmountPaid": ticket.totalAmountPaid,
          "imageFileId": ticket.imageFileId,
          "category": ticket.category,
          "userId": ticket.userId,
          "eventId": ticket.eventId,
          "qrCodeFileId": ticket.qrCodeFileId,
          "quantity": ticket.quantity,
          "isListedForSale": ticket.isListedForSale.toString(), // Convert boolean to string
          "checkedIn": ticket.checkedIn,
          "pricePerTicket": ticket.pricePerTicket
        };

        // Create document in suspected fraud table
        const response = await database.createDocument(
          databaseId, 
          suspectedFraudTableId, 
          ID.unique(),
          ticketData
        );

        console.log(`Moved fraud ticket with ID: ${ticket.$id} to suspected fraud table.`);

        // Delete document from tickets collection
        await database.deleteDocument(databaseId, ticketsCollectionId, ticket.$id);

        // Delete user's account from Auth
        await users.deleteUser(ticket.userId);

        console.log(`Deleted user account with ID: ${ticket.userId}`);
      }
    }
  } catch (error) {
    console.error('Error handling fraud tickets:', error);
  }
}


// Main function for Appwrite execution
export default async ({ req, res, log, error }) => {
  try {
    log('Executing scheduled tasks...');

    // Call your functions
    await deleteChatMessages();
    await moveExpiredTickets();
    await deleteExpiredInstantSaleTickets();
    await moveExpiredEvents();
    await handleFraudTickets(); // Call the new function

    // Send success response
    return res.json({
      message: 'Scheduled tasks completed successfully.',
    });
  } catch (err) {
    // Log and handle any errors
    error('Error executing tasks: ', err);
    return res.status(500).json({
      error: 'Error executing scheduled tasks.',
      details: err.message,
    });
  }
};
