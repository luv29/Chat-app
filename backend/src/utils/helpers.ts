import fs from "fs";
import mongoose from "mongoose";
import { Request } from "express";
import logger from "../logger/winston.logger";
import "mongoose-paginate-v2";

/**
 * @description utility function to only include fields present in the fieldsArray
 * For example,
 * ```js
 * let fieldsArray = [
 * {
 * id:1,
 * name:"John Doe",
 * email:"john@doe.com"
 * phone: "123456"
 * },
 * {
 * id:2,
 * name:"Mark H",
 * email:"mark@h.com"
 * phone: "563526"
 * }
 * ]
 * let fieldsArray = ["name", "email"]
 * 
 * const filteredKeysObject = filterObjectKeys(fieldsArray, fieldsArray)
 * console.log(filteredKeysObject) 
 * 
//  Above line's output will be:
//  [
//      {
//        name:"John Doe",
//        email:"john@doe.com"
//      },
//      {
//        name:"Mark H",
//        email:"mark@h.com"
//      }
//  ]
 * 
 * ```
 */
export const filterObjectKeys = (fieldsArray: string[], objectArray: any[]): any[] => {
    const filteredArray = structuredClone(objectArray).map((originalObj) => {
        let obj: Record<string, any> = {};

        structuredClone(fieldsArray)?.forEach((field) => {
            if (field?.trim() in originalObj) {
                obj[field] = originalObj[field];
            }
        });

        if (Object.keys(obj).length > 0) return obj;

        return originalObj;
    });
    return filteredArray;
};

export const getPaginatedPayload = (dataArray: any[], page: number, limit: number) => {
  const startPosition = +(page - 1) * limit;

  const totalItems = dataArray.length; // total documents present after applying search query
  const totalPages = Math.ceil(totalItems / limit);

  dataArray = structuredClone(dataArray).slice(
    startPosition,
    startPosition + limit
  );

  const payload = {
    page,
    limit,
    totalPages,
    previousPage: page > 1,
    nextPage: page < totalPages,
    totalItems,
    currentPageItems: dataArray?.length,
    data: dataArray,
  };
  return payload;
};

/**
 * @description returns the file's static path from where the server is serving the static image
 */
export const getStaticFilePath = (req: Request, fileName: string): string => {
    return `${req.protocol}://${req.get("host")}/images/${fileName}`;
};

/**
 * @description returns the file's local path in the file system to assist future removal
 */
export const getLocalPath = (fileName: string): string => {
    return `public/images/${fileName}`;
};

/**
 * @description Removed the local file from the local file system based on the file path
 */
export const removeLocalFile = (localPath: string): void => {
    fs.unlink(localPath, (err) => {
        if (err) logger.error("Error while removing local files: ", err);
        else {
            logger.info("Removed local: ", localPath);
        }
    });
};

/**
 * @description **This utility function is responsible for removing unused image files due to the api fail**.
 *
 * **For example:**
 * * This can occur when product is created.
 * * In product creation process the images are getting uploaded before product gets created.
 * * Once images are uploaded and if there is an error creating a product, the uploaded images are unused.
 * * In such case, this function will remove those unused images.
 */
export const removeUnusedMulterImageFilesOnError = (req: Request): void => {
    try {
        const multerFile = req.file;
        const multerFiles = req.files;

        if (multerFile) {
            // If there is file uploaded and there is validation error
            // We want to remove that file
            removeLocalFile(multerFile.path);
        }

        if (multerFiles) {
            /** @type {Express.Multer.File[][]}  */
            const filesValueArray = Object.values(multerFiles as Record<string, Express.Multer.File[]>);
            // If there are multiple files uploaded for more than one fields
            // We want to remove those files as well
            filesValueArray.map((fileFields) => {
            fileFields.map((fileObject) => {
                removeLocalFile(fileObject.path);
            });
        });
    }
    } catch (error) {
        // fail silently
        logger.error("Error while removing image files: ", error);
    }
};

export const getMongoosePaginationOptions = ({
    page = 1,
    limit = 10,
    customLabels,
}: {
    page: number;
    limit: number;
    customLabels: mongoose.CustomLabels;
}): mongoose.PaginateOptions => {
    return {
        page: Math.max(page, 1),
        limit: Math.max(limit, 1),
        pagination: true,
        customLabels: {
            pagingCounter: "serialNumberStartFrom",
            ...customLabels,
        },
    };
};

export const getRandomNumber = (max: number): number => {
  return Math.floor(Math.random() * max);
};