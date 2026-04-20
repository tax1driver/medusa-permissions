import { defineLink } from "@medusajs/framework/utils";
import CustomerModule from "@medusajs/medusa/customer";
import { PermissionsModule } from "../modules/permissions";

export default defineLink(
    {
        linkable: PermissionsModule.linkable.rbacRole,
        isList: true,
    },
    {
        linkable: CustomerModule.linkable.customer,
        isList: true
    }
);