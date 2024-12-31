import { Client } from 'node-appwrite';

// Initialize Appwrite Client
const sdk = require('node-appwrite');
const client = new Client();


client
  .setEndpoint(process.env.APPWRITE_ENDPOINT) // Appwrite endpoint
  .setProject(process.env.APPWRITE_PROJECT_ID) // Project ID
  .setKey(process.env.APPWRITE_API_KEY); // API Key

// Ensure that the client is initialized
if (!client) {
  throw new Error("Appwrite Client is not initialized");
}

const database = new sdk.Databases(client);

// Ensure database is initialized
if (!database) {
  throw new Error("Appwrite Database is not initialized");
}

// Your Appwrite function to delete expired chat messages
async function deleteChatMessages() {
  try {
    const messagesCollectionId = process.env.CHAT_MESSAGES_COLLECTION_ID;
    const groupsCollectionId = process.env.GROUPS_COLLECTION_ID;

    if (!messagesCollectionId || !groupsCollectionId) {
      throw new Error('Missing collection IDs in environment variables');
    }

    const messages = await database.listDocuments(messagesCollectionId);

    for (let message of messages.documents) {
      const groupId = message.groupsId;

      const groupExists = await database.listDocuments(groupsCollectionId, [
        sdk.Query.equal('$id', groupId),
      ]);

      if (groupExists.documents.length === 0) {
        await database.deleteDocument(messagesCollectionId, message.$id);
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

    if (!ticketsForInstantSaleCollectionId || !ticketsCollectionId) {
      throw new Error('Missing collection IDs in environment variables');
    }

    const tickets = await database.listDocuments(ticketsForInstantSaleCollectionId);

    for (let ticket of tickets.documents) {
      const expiryDateStr = ticket.expiry;
      const expiryDateParts = expiryDateStr.split('/');
      const expiryDate = new Date(
        `${expiryDateParts[1]}/${expiryDateParts[0]}/${expiryDateParts[2]}`
      );
      const currentDate = new Date();

      if (expiryDate < currentDate) {
        const originalTicketId = ticket.ticketId;
        const listingQuantity = ticket.quantity;

        const originalTicket = await database.getDocument(ticketsCollectionId, originalTicketId);

        const updatedQuantity = originalTicket.quantity + listingQuantity;
        await database.updateDocument(ticketsCollectionId, originalTicketId, {
          quantity: updatedQuantity,
          isListedForSale: false,
        });

        console.log(`Updated original ticket with ID: ${originalTicketId}, new quantity: ${updatedQuantity}`);

        await database.deleteDocument(ticketsForInstantSaleCollectionId, ticket.$id);
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

    if (!ticketsCollectionId || !expiredTicketsCollectionId) {
      throw new Error('Missing collection IDs in environment variables');
    }

    const tickets = await database.listDocuments(ticketsCollectionId);

    for (let ticket of tickets.documents) {
      const eventDateStr = ticket.eventDate;
      const eventDate = new Date(eventDateStr);
      const currentDate = new Date();

      if (eventDate < currentDate) {
        await database.createDocument(expiredTicketsCollectionId, ticket);
        await database.deleteDocument(ticketsCollectionId, ticket.$id);
        console.log(`Moved ticket with ID: ${ticket.$id} to expired tickets.`);
      }
    }
  } catch (error) {
    console.error('Error moving expired tickets:', error);
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
