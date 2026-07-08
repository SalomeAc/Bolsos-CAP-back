require("dotenv").config();
const QuotationController = require("../api/controllers/quotationController");
const NotificationService = require("../api/services/notificationService");
const QuotationDAO = require("../api/dao/quotationDAO");
const Message = require("../api/models/message");
const { connectDB, disconnectDB } = require("../api/config/database");

async function hasQuotationOffer(quotationId) {
  const count = await Message.countDocuments({
    quotation: quotationId,
    messageType: "quotation_offer",
  });
  return count > 0;
}

async function main() {
  await connectDB();

  const catalogQuotations = await QuotationDAO.getAll({ kind: "catalog" });

  let repaired = 0;
  let notified = 0;

  for (const quotation of catalogQuotations) {
    let populated = await QuotationDAO.read(quotation._id);

    if (populated.status === "pendiente") {
      const result = await QuotationController._applyCatalogAutoQuotation(
        quotation._id,
        quotation.solicitud?._id || quotation.solicitud,
      );
      if (!result.applied) {
        continue;
      }
      repaired += 1;
      populated = await QuotationDAO.read(quotation._id);
    }

    if (
      populated.status !== "cotizada" ||
      !(populated.finalQuotation?.amount > 0)
    ) {
      continue;
    }

    if (await hasQuotationOffer(populated._id)) {
      continue;
    }

    await NotificationService.notifyClientQuotationSent(populated);
    notified += 1;
    console.log(
      `✓ Mensaje enviado para cotización ${populated._id} ($${populated.finalQuotation.amount})`,
    );
  }

  console.log(`\nCotizaciones auto-cotizadas: ${repaired}`);
  console.log(`Mensajes de oferta enviados: ${notified}`);

  await disconnectDB();
}

main().catch(async (err) => {
  console.error("Error en backfill-catalog-auto-quote:", err);
  await disconnectDB();
  process.exit(1);
});
