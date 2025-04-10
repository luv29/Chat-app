import multer, { StorageEngine } from "multer";
import { Request } from "express";

const storage: StorageEngine = multer.diskStorage({
    destination: function (
        req: Request,
        file: Express.Multer.File,
        cb: (error: Error | null, destination: string) => void
        ): void {
        // This storage needs public/images folder in the root directory
        // Else it will throw an error saying cannot find path public/images
        cb(null, "./public/images");
    },

    // Store file in a .png/.jpeg/.jpg format instead of binary
    filename: function (
        req: Request,
        file: Express.Multer.File,
        cb: (error: Error | null, filename: string) => void
        ): void {
        let fileExtension = "";
        if (file.originalname.split(".").length > 1) {
            fileExtension = file.originalname.substring(
            file.originalname.lastIndexOf(".")
            );
        }

        const filenameWithoutExtension = file.originalname
            .toLowerCase()
            .split(" ")
            .join("-")
            ?.split(".")[0];

        cb(
            null,
            filenameWithoutExtension +
            Date.now() +
            Math.ceil(Math.random() * 1e5) + // avoid rare name conflict
            fileExtension
        );
    },
});

// Middleware responsible to read form data and upload the File object to the mentioned path
export const upload = multer({
    storage,
    limits: {
        fileSize: 1 * 1000 * 1000, // 1 MB
    },
});